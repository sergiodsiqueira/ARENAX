import asyncio
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from arenax.application.auth import AuthenticationService, UserAdministrationService
from arenax.application.use_cases import (
    ArenaInfrastructureService,
    PaymentService,
    PhysicalEventService,
    SessionService,
)
from arenax.domain.errors import (
    DomainError,
    EntityNotFound,
    ForbiddenAccess,
    InvalidAccess,
    InvalidCredentials,
)
from arenax.domain.identity import User, UserRole, UserStatus
from arenax.infrastructure.config import settings
from arenax.infrastructure.live_gateway import LiveGatewayUnavailable, MediaMtxGateway
from arenax.infrastructure.operational_events import operational_events
from arenax.infrastructure.security import (
    Argon2PasswordHasher,
    hash_access_token,
    issue_access_token,
)
from arenax.infrastructure.uow import SqlAlchemyUnitOfWork

from .schemas import (
    AdminUserResponse,
    ButtonPressedRequest,
    ButtonPressedResponse,
    CameraHealthResponse,
    CameraLiveResponse,
    ChangeExpectedAmountRequest,
    ClientResponse,
    CreatedResourceResponse,
    CreateSessionRequest,
    CreateSpaceRequest,
    CreateUserRequest,
    EquipmentRequest,
    EquipmentResponse,
    ExpectedAmountResponse,
    ExtendSessionRequest,
    LoginRequest,
    LoginResponse,
    NamedResourceRequest,
    NamedResourceResponse,
    OperationalSettingsInput,
    OperationalSettingsResponse,
    PaymentResponse,
    RegisterPaymentRequest,
    ResetUserPasswordRequest,
    SessionResponse,
    SpaceResponse,
    UpdateClientRequest,
    UpdateSpaceRequest,
    UpdateUserRequest,
    UserResponse,
)

app = FastAPI(title="ARENAX API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
sessions = SessionService(SqlAlchemyUnitOfWork)
physical_events = PhysicalEventService(SqlAlchemyUnitOfWork)
payments = PaymentService(SqlAlchemyUnitOfWork)
infrastructure = ArenaInfrastructureService(SqlAlchemyUnitOfWork)
password_hasher = Argon2PasswordHasher()
authentication = AuthenticationService(
    SqlAlchemyUnitOfWork, password_hasher, issue_access_token, hash_access_token
)
user_administration = UserAdministrationService(SqlAlchemyUnitOfWork, password_hasher)
live_gateway = MediaMtxGateway(
    settings.mediamtx_api_url,
    settings.mediamtx_public_webrtc_url,
    settings.live_path_secret,
)


@app.exception_handler(DomainError)
async def domain_error_handler(_, exc: DomainError):
    if isinstance(exc, EntityNotFound):
        code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, (InvalidCredentials, InvalidAccess)):
        code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, ForbiddenAccess):
        code = status.HTTP_403_FORBIDDEN
    else:
        code = status.HTTP_409_CONFLICT
    return JSONResponse(status_code=code, content={"code": type(exc).__name__, "message": str(exc)})


@app.exception_handler(ValueError)
async def value_error_handler(_, exc: ValueError):
    return JSONResponse(status_code=422, content={"code": "InvalidIntention", "message": str(exc)})


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}


def user_response(user) -> UserResponse:
    return UserResponse(id=user.id, name=user.name, email=user.email, role=user.role.value)


def admin_user_response(user) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id, name=user.name, email=user.email, role=user.role.value,
        status=user.status.value, created_at=user.created_at, updated_at=user.updated_at,
        last_access_at=user.last_access_at,
    )


@app.post("/api/v1/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response):
    now = datetime.now(UTC)
    result = await authentication.login(
        request.email,
        request.password,
        request.remember,
        now,
        timedelta(hours=settings.access_duration_hours),
        timedelta(days=settings.persistent_access_duration_days),
    )
    max_age = int((result.expires_at - now).total_seconds()) if result.persistent else None
    response.set_cookie(
        key=settings.access_cookie_name,
        value=result.token,
        max_age=max_age,
        httponly=True,
        secure=settings.access_cookie_secure,
        samesite="lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return LoginResponse(user=user_response(result.user))


@app.get("/api/v1/auth/me", response_model=UserResponse)
async def current_user(request: Request):
    user = await authentication.current_user(
        request.cookies.get(settings.access_cookie_name), datetime.now(UTC)
    )
    return user_response(user)


async def require_authenticated_user(request: Request) -> User:
    return await authentication.current_user(
        request.cookies.get(settings.access_cookie_name), datetime.now(UTC)
    )


def require_roles(*roles: UserRole):
    async def authorize(
        user: Annotated[User, Depends(require_authenticated_user)],
    ) -> User:
        if user.role not in roles:
            raise ForbiddenAccess("Usuário sem permissão para esta operação")
        return user

    return authorize


require_administrator = require_roles(UserRole.OWNER, UserRole.ADMINISTRATOR)
AuthenticatedUser = Annotated[User, Depends(require_authenticated_user)]
AdministratorUser = Annotated[User, Depends(require_administrator)]


@app.get("/api/v1/operational-events")
async def stream_operational_events(request: Request, _user: AuthenticatedUser):
    async def event_stream():
        async with operational_events.subscribe() as queue:
            yield "event: ready\ndata: {}\n\n"
            while not await request.is_disconnected():
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"event: operational-update\ndata: {payload}\n\n"
                except TimeoutError:
                    yield ": keep-alive\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/auth/logout", status_code=204)
async def logout(request: Request, response: Response):
    await authentication.logout(
        request.cookies.get(settings.access_cookie_name), datetime.now(UTC)
    )
    response.delete_cookie(settings.access_cookie_name, path="/")
    response.headers["Clear-Site-Data"] = '"cache", "cookies", "storage"'
    response.headers["Cache-Control"] = "no-store"


@app.get("/api/v1/users", response_model=list[AdminUserResponse])
async def list_users(user: AdministratorUser):
    return [admin_user_response(item) for item in await user_administration.list_users(user)]


@app.post("/api/v1/users", response_model=AdminUserResponse, status_code=201)
async def create_user(request: CreateUserRequest, user: AdministratorUser):
    created = await user_administration.create_user(
        request.name, request.email, request.password, UserRole(request.role), datetime.now(UTC), user
    )
    return admin_user_response(created)


@app.put("/api/v1/users/{user_id}", response_model=AdminUserResponse)
async def update_user(user_id: UUID, request: UpdateUserRequest, user: AdministratorUser):
    updated = await user_administration.update_user(
        user, user_id, UserRole(request.role), UserStatus(request.status), datetime.now(UTC)
    )
    return admin_user_response(updated)


@app.post("/api/v1/users/{user_id}/reset-password", status_code=204)
async def reset_user_password(
    user_id: UUID, request: ResetUserPasswordRequest, user: AdministratorUser
):
    await user_administration.reset_password(user, user_id, request.password, datetime.now(UTC))


@app.get("/api/v1/settings", response_model=OperationalSettingsResponse)
async def get_operational_settings(_user: AdministratorUser):
    return await infrastructure.get_operational_settings()


@app.put("/api/v1/settings", response_model=OperationalSettingsResponse)
async def update_operational_settings(
    request: OperationalSettingsInput, _user: AdministratorUser
):
    return await infrastructure.update_operational_settings(
        request.default_session_duration_minutes,
        request.replay_pre_duration_seconds,
        request.replay_post_duration_seconds,
        request.calculate_actual_time,
        datetime.now(UTC),
    )


@app.post("/api/v1/clients", response_model=CreatedResourceResponse, status_code=201)
async def create_client(
    request: NamedResourceRequest, _user: AuthenticatedUser
):
    client_id = await infrastructure.create_client(request.name)
    operational_events.publish("clients", client_id)
    return {"id": client_id}


@app.get("/api/v1/clients", response_model=list[ClientResponse])
async def list_clients(_user: AuthenticatedUser):
    return await infrastructure.list_clients()


@app.put("/api/v1/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: UUID, request: UpdateClientRequest, _user: AuthenticatedUser):
    result = await infrastructure.update_client(client_id, request.name, request.administrative_status)
    operational_events.publish("clients", client_id)
    return result


@app.delete("/api/v1/clients/{client_id}", status_code=204)
async def delete_client(client_id: UUID, _user: AuthenticatedUser):
    await infrastructure.delete_client(client_id)
    operational_events.publish("clients", client_id)


@app.post("/api/v1/people", response_model=CreatedResourceResponse, status_code=201, deprecated=True)
async def create_person_compatibility(request: NamedResourceRequest, _user: AuthenticatedUser):
    return {"id": await infrastructure.create_client(request.name)}


@app.get("/api/v1/people", response_model=list[NamedResourceResponse], deprecated=True)
async def list_people_compatibility(_user: AuthenticatedUser):
    return await infrastructure.list_clients()


@app.post("/api/v1/spaces", response_model=CreatedResourceResponse, status_code=201)
async def create_space(
    request: CreateSpaceRequest, _user: AdministratorUser
):
    space_id = await infrastructure.create_space(request.name, request.minute_rate_cents)
    operational_events.publish("spaces", space_id)
    return {"id": space_id}


@app.get("/api/v1/spaces", response_model=list[SpaceResponse])
async def list_spaces(_user: AuthenticatedUser):
    return await infrastructure.list_spaces()


@app.put("/api/v1/spaces/{space_id}", response_model=SpaceResponse)
async def update_space(space_id: UUID, request: UpdateSpaceRequest, _user: AdministratorUser):
    result = await infrastructure.update_space(
        space_id, request.name, request.administrative_status, request.minute_rate_cents
    )
    operational_events.publish("spaces", space_id)
    return result


@app.delete("/api/v1/spaces/{space_id}", status_code=204)
async def delete_space(space_id: UUID, _user: AdministratorUser):
    await infrastructure.delete_space(space_id)
    operational_events.publish("spaces", space_id)


@app.post("/api/v1/equipments", response_model=CreatedResourceResponse, status_code=201)
async def create_equipment(
    request: EquipmentRequest, _user: AdministratorUser
):
    try:
        entity_id = await infrastructure.create_equipment(
            request.space_id, request.kind, request.external_id, request.configuration
        )
        return {"id": entity_id}
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.get("/api/v1/equipments", response_model=list[EquipmentResponse])
async def list_equipments(
    _user: AuthenticatedUser, space_id: UUID | None = None
):
    return await infrastructure.list_equipments(space_id)


@app.put("/api/v1/equipments/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: UUID, request: EquipmentRequest, _user: AdministratorUser
):
    return await infrastructure.update_equipment(
        equipment_id,
        request.space_id,
        request.kind,
        request.external_id,
        request.configuration,
        request.administrative_status,
    )


@app.delete("/api/v1/equipments/{equipment_id}", status_code=204)
async def delete_equipment(equipment_id: UUID, _user: AdministratorUser):
    async with SqlAlchemyUnitOfWork() as uow:
        equipment = await uow.get_equipment(equipment_id)
    await infrastructure.delete_equipment(equipment_id)
    if equipment and equipment["kind"] == "camera":
        try:
            await live_gateway.remove_camera(equipment_id)
        except LiveGatewayUnavailable:
            pass


@app.get("/api/v1/cameras/{camera_id}/health", response_model=CameraHealthResponse)
async def camera_health(camera_id: UUID, _user: AdministratorUser):
    health_path = Path(settings.media_root) / "capture-health" / f"{camera_id}.json"
    if not health_path.is_file():
        return CameraHealthResponse(camera_id=camera_id, status="waiting")
    try:
        data = json.loads(health_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "Camera health is temporarily unavailable") from exc
    return CameraHealthResponse(
        camera_id=camera_id,
        status=data.get("status", "unknown"),
        checked_at=data.get("checkedAt"),
        error=data.get("error"),
    )


@app.post("/api/v1/cameras/{camera_id}/live", response_model=CameraLiveResponse)
async def camera_live(camera_id: UUID, _user: AdministratorUser):
    async with SqlAlchemyUnitOfWork() as uow:
        equipment = await uow.get_equipment(camera_id)
    if not equipment or equipment["kind"] != "camera":
        raise EntityNotFound("Câmera não encontrada")
    capture_url = str(equipment["configuration"].get("capture_url", "")).strip()
    if not capture_url.lower().startswith(("rtsp://", "rtsps://")):
        raise ValueError("A Câmera não possui uma URL RTSP válida")
    try:
        url = await live_gateway.ensure_camera(
            camera_id,
            capture_url,
            str(equipment["configuration"].get("rtsp_transport", "automatic")),
        )
    except LiveGatewayUnavailable as exc:
        raise HTTPException(503, "Visualização ao vivo temporariamente indisponível") from exc
    return CameraLiveResponse(url=url)


@app.get("/api/v1/moments/{moment_id}/replay")
async def get_moment_replay(moment_id: UUID, _user: AuthenticatedUser):
    async with SqlAlchemyUnitOfWork() as uow:
        replay_path = await uow.get_moment_replay_path(moment_id)
    if not replay_path:
        raise HTTPException(404, "Replay not found")
    media_root = Path(settings.media_root).resolve()
    path = Path(replay_path).resolve()
    if media_root not in path.parents or not path.is_file():
        raise HTTPException(404, "Replay file not found")
    return FileResponse(path, media_type="video/mp4", filename=f"{moment_id}.mp4")


@app.post("/api/v1/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    request: CreateSessionRequest, _user: AuthenticatedUser
):
    try:
        result = await sessions.create(request.responsible_client_id, tuple(request.space_ids),
            request.scheduled_start, request.scheduled_end, datetime.now(UTC))
        operational_events.publish("sessions", result.id)
        return result
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.get("/api/v1/sessions", response_model=list[SessionResponse])
async def get_agenda(
    start: datetime,
    end: datetime,
    _user: AuthenticatedUser,
    space_id: UUID | None = None,
):
    return await sessions.agenda(start, end, space_id)


@app.get("/api/v1/sessions/in-progress", response_model=list[SessionResponse])
async def get_in_progress_sessions(_user: AuthenticatedUser):
    return await sessions.in_progress()


@app.get("/api/v1/sessions/{session_id}")
async def get_session_dossier(
    session_id: UUID, _user: AuthenticatedUser
):
    return await sessions.dossier(session_id, datetime.now(UTC))


@app.post(
    "/api/v1/sessions/{session_id}/payments",
    response_model=PaymentResponse,
    status_code=201,
)
async def register_payment(
    session_id: UUID,
    request: RegisterPaymentRequest,
    user: AuthenticatedUser,
):
    result = await payments.register(
        session_id,
        request.amount_cents,
        request.method,
        request.note,
        user.id,
        datetime.now(UTC),
    )
    operational_events.publish("sessions", session_id)
    return result


@app.put(
    "/api/v1/sessions/{session_id}/expected-amount",
    response_model=ExpectedAmountResponse,
)
async def change_expected_amount(
    session_id: UUID,
    request: ChangeExpectedAmountRequest,
    user: AuthenticatedUser,
):
    amount = await payments.change_expected_amount(
        session_id, request.amount_cents, user.id, datetime.now(UTC)
    )
    operational_events.publish("sessions", session_id)
    return {"amount_cents": amount}


@app.post(
    "/api/v1/sessions/{session_id}/expected-amount/recalculate",
    response_model=ExpectedAmountResponse,
)
async def recalculate_expected_amount(session_id: UUID, user: AuthenticatedUser):
    amount = await payments.recalculate_expected_amount(
        session_id, user.id, datetime.now(UTC)
    )
    operational_events.publish("sessions", session_id)
    return {"amount_cents": amount}


@app.post("/api/v1/sessions/{session_id}/actions/{action}", response_model=SessionResponse | None)
async def transition_session(
    session_id: UUID, action: str, _user: AuthenticatedUser
):
    if action not in {"confirm", "start", "finish", "cancel", "no_show"}:
        raise HTTPException(404, "Unknown action")
    result = await sessions.transition(session_id, action, datetime.now(UTC))
    operational_events.publish("sessions", session_id)
    if result is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return result


@app.post("/api/v1/sessions/{session_id}/extend", response_model=SessionResponse)
async def extend_session(
    session_id: UUID,
    request: ExtendSessionRequest,
    _user: AuthenticatedUser,
):
    result = await sessions.transition(session_id, "extend", datetime.now(UTC), request.scheduled_end)
    operational_events.publish("sessions", session_id)
    return result


@app.post("/api/v1/events/button-pressed", response_model=ButtonPressedResponse, status_code=202)
async def button_pressed(request: ButtonPressedRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=8, max_length=160)):
    if request.timestamp.tzinfo is None:
        raise HTTPException(422, "timestamp must include a timezone")
    result = await physical_events.button_pressed(request.device_id, request.timestamp, idempotency_key)
    return ButtonPressedResponse(accepted=result.accepted, reason=result.reason,
        moment_id=result.moment_id, session_id=result.session_id)
