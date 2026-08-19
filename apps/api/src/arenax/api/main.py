from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from arenax.application.auth import AuthenticationService
from arenax.application.use_cases import (
    ArenaInfrastructureService,
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
from arenax.domain.identity import User, UserRole
from arenax.infrastructure.config import settings
from arenax.infrastructure.security import (
    Argon2PasswordHasher,
    hash_access_token,
    issue_access_token,
)
from arenax.infrastructure.uow import SqlAlchemyUnitOfWork

from .schemas import (
    ButtonPressedRequest,
    ButtonPressedResponse,
    CreatedResourceResponse,
    CreateSessionRequest,
    EquipmentRequest,
    EquipmentResponse,
    ExtendSessionRequest,
    LoginRequest,
    LoginResponse,
    NamedResourceRequest,
    NamedResourceResponse,
    SessionResponse,
    SpaceResponse,
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
infrastructure = ArenaInfrastructureService(SqlAlchemyUnitOfWork)
password_hasher = Argon2PasswordHasher()
authentication = AuthenticationService(
    SqlAlchemyUnitOfWork, password_hasher, issue_access_token, hash_access_token
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


@app.post("/api/v1/auth/logout", status_code=204)
async def logout(request: Request, response: Response):
    await authentication.logout(
        request.cookies.get(settings.access_cookie_name), datetime.now(UTC)
    )
    response.delete_cookie(settings.access_cookie_name, path="/")
    response.headers["Clear-Site-Data"] = '"cache", "cookies", "storage"'
    response.headers["Cache-Control"] = "no-store"


@app.post("/api/v1/people", response_model=CreatedResourceResponse, status_code=201)
async def create_person(
    request: NamedResourceRequest, _user: AdministratorUser
):
    return {"id": await infrastructure.create_person(request.name)}


@app.get("/api/v1/people", response_model=list[NamedResourceResponse])
async def list_people(_user: AuthenticatedUser):
    return await infrastructure.list_people()


@app.post("/api/v1/spaces", response_model=CreatedResourceResponse, status_code=201)
async def create_space(
    request: NamedResourceRequest, _user: AdministratorUser
):
    return {"id": await infrastructure.create_space(request.name)}


@app.get("/api/v1/spaces", response_model=list[SpaceResponse])
async def list_spaces(_user: AuthenticatedUser):
    return await infrastructure.list_spaces()


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


@app.post("/api/v1/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    request: CreateSessionRequest, _user: AuthenticatedUser
):
    try:
        return await sessions.create(request.responsible_person_id, tuple(request.space_ids),
            request.scheduled_start, request.scheduled_end, datetime.now(UTC))
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


@app.get("/api/v1/sessions/{session_id}")
async def get_session_dossier(
    session_id: UUID, _user: AuthenticatedUser
):
    return await sessions.dossier(session_id)


@app.post("/api/v1/sessions/{session_id}/actions/{action}", response_model=SessionResponse)
async def transition_session(
    session_id: UUID, action: str, _user: AuthenticatedUser
):
    if action not in {"start", "finish", "cancel"}:
        raise HTTPException(404, "Unknown action")
    return await sessions.transition(session_id, action, datetime.now(UTC))


@app.post("/api/v1/sessions/{session_id}/extend", response_model=SessionResponse)
async def extend_session(
    session_id: UUID,
    request: ExtendSessionRequest,
    _user: AuthenticatedUser,
):
    return await sessions.transition(session_id, "extend", datetime.now(UTC), request.scheduled_end)


@app.post("/api/v1/events/button-pressed", response_model=ButtonPressedResponse, status_code=202)
async def button_pressed(request: ButtonPressedRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=8, max_length=160)):
    if request.timestamp.tzinfo is None:
        raise HTTPException(422, "timestamp must include a timezone")
    result = await physical_events.button_pressed(request.device_id, request.timestamp, idempotency_key)
    return ButtonPressedResponse(accepted=result.accepted, reason=result.reason,
        moment_id=result.moment_id, session_id=result.session_id)
