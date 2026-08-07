from datetime import datetime, timezone
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException, status
from fastapi.responses import JSONResponse

from arenax.application.use_cases import ArenaInfrastructureService, PhysicalEventService, SessionService
from arenax.domain.errors import DomainError, EntityNotFound
from arenax.infrastructure.uow import SqlAlchemyUnitOfWork
from .schemas import ButtonPressedRequest, ButtonPressedResponse, CreatedResourceResponse
from .schemas import CreateSessionRequest, EquipmentRequest, ExtendSessionRequest
from .schemas import NamedResourceRequest, SessionResponse

app = FastAPI(title="ARENAX API", version="0.1.0")
sessions = SessionService(SqlAlchemyUnitOfWork)
physical_events = PhysicalEventService(SqlAlchemyUnitOfWork)
infrastructure = ArenaInfrastructureService(SqlAlchemyUnitOfWork)


@app.exception_handler(DomainError)
async def domain_error_handler(_, exc: DomainError):
    code = status.HTTP_404_NOT_FOUND if isinstance(exc, EntityNotFound) else status.HTTP_409_CONFLICT
    return JSONResponse(status_code=code, content={"code": type(exc).__name__, "message": str(exc)})


@app.exception_handler(ValueError)
async def value_error_handler(_, exc: ValueError):
    return JSONResponse(status_code=422, content={"code": "InvalidIntention", "message": str(exc)})


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}


@app.post("/api/v1/people", response_model=CreatedResourceResponse, status_code=201)
async def create_person(request: NamedResourceRequest):
    return {"id": await infrastructure.create_person(request.name)}


@app.post("/api/v1/spaces", response_model=CreatedResourceResponse, status_code=201)
async def create_space(request: NamedResourceRequest):
    return {"id": await infrastructure.create_space(request.name)}


@app.post("/api/v1/equipments", response_model=CreatedResourceResponse, status_code=201)
async def create_equipment(request: EquipmentRequest):
    try:
        entity_id = await infrastructure.create_equipment(
            request.space_id, request.kind, request.external_id, request.configuration
        )
        return {"id": entity_id}
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/api/v1/sessions", response_model=SessionResponse, status_code=201)
async def create_session(request: CreateSessionRequest):
    try:
        return await sessions.create(request.responsible_person_id, tuple(request.space_ids),
            request.scheduled_start, request.scheduled_end, datetime.now(timezone.utc))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.get("/api/v1/sessions/{session_id}")
async def get_session_dossier(session_id: UUID):
    return await sessions.dossier(session_id)


@app.post("/api/v1/sessions/{session_id}/actions/{action}", response_model=SessionResponse)
async def transition_session(session_id: UUID, action: str):
    if action not in {"start", "finish", "cancel"}:
        raise HTTPException(404, "Unknown action")
    return await sessions.transition(session_id, action, datetime.now(timezone.utc))


@app.post("/api/v1/sessions/{session_id}/extend", response_model=SessionResponse)
async def extend_session(session_id: UUID, request: ExtendSessionRequest):
    return await sessions.transition(session_id, "extend", datetime.now(timezone.utc), request.scheduled_end)


@app.post("/api/v1/events/button-pressed", response_model=ButtonPressedResponse, status_code=202)
async def button_pressed(request: ButtonPressedRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=8, max_length=160)):
    if request.timestamp.tzinfo is None:
        raise HTTPException(422, "timestamp must include a timezone")
    result = await physical_events.button_pressed(request.device_id, request.timestamp, idempotency_key)
    return ButtonPressedResponse(accepted=result.accepted, reason=result.reason,
        moment_id=result.moment_id, session_id=result.session_id)
