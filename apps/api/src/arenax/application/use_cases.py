from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from arenax.domain.errors import (
    ClientInUse,
    EntityNotFound,
    InactiveSpace,
    SessionConflict,
    SpaceInUse,
)
from arenax.domain.moment import Moment
from arenax.domain.session import Session


@dataclass(frozen=True)
class ButtonPressResult:
    accepted: bool
    reason: str
    moment_id: UUID | None = None
    session_id: UUID | None = None


class SessionService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    async def create(
        self,
        responsible_client_id: UUID,
        space_ids: tuple[UUID, ...],
        start: datetime,
        end: datetime,
        now: datetime,
    ) -> Session:
        session = Session(responsible_client_id, space_ids, start, end)
        session._record("SessionCreated", now)
        async with self._uow_factory() as uow:
            await uow.lock_spaces(space_ids)
            if not await uow.spaces_are_active(space_ids):
                raise InactiveSpace("Only active Spaces can be scheduled")
            if await uow.has_conflict(space_ids, start, end):
                raise SessionConflict("One or more Spaces are unavailable in this period")
            await uow.add_session(session)
            await uow.add_timeline(session.id, "SessionCreated", now, {})
            await uow.commit()
        return session

    async def dossier(self, session_id: UUID) -> dict:
        async with self._uow_factory() as uow:
            dossier = await uow.session_dossier(session_id)
            if dossier is None:
                raise EntityNotFound("Session not found")
            return dossier

    async def agenda(
        self, start: datetime, end: datetime, space_id: UUID | None = None
    ) -> list[Session]:
        Session._require_aware(start)
        Session._require_aware(end)
        if end <= start:
            raise ValueError("end must be after start")
        async with self._uow_factory() as uow:
            return await uow.list_sessions(start, end, space_id)

    async def in_progress(self) -> list[Session]:
        async with self._uow_factory() as uow:
            return await uow.list_in_progress_sessions()

    async def transition(self, session_id: UUID, action: str, now: datetime, new_end=None) -> Session | None:
        async with self._uow_factory() as uow:
            session = await uow.get_session(session_id, lock=True)
            if not session:
                raise EntityNotFound("Session not found")
            await uow.lock_spaces(session.space_ids)
            if action == "start":
                session.start(now)
            elif action == "confirm":
                session.confirm(now)
            elif action == "finish":
                session.finish(now)
            elif action == "cancel":
                if not await uow.session_has_associated_events(session.id):
                    await uow.delete_session(session.id)
                    await uow.commit()
                    return None
                session.cancel(now)
            elif action == "no_show":
                session.mark_no_show(now)
            elif action == "extend":
                if new_end is None:
                    raise ValueError("new_end is required")
                if await uow.has_conflict(
                    session.space_ids, session.scheduled_end, new_end, exclude=session.id
                ):
                    raise SessionConflict("The extension conflicts with another Session")
                session.extend(new_end, now)
            else:
                raise ValueError("Unknown Session action")
            await uow.save_session(session)
            await uow.add_timeline(session.id, session.events[-1].name, now, {})
            await uow.commit()
        return session


class PhysicalEventService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    async def button_pressed(
        self, device_id: str, occurred_at: datetime, idempotency_key: str
    ) -> ButtonPressResult:
        async with self._uow_factory() as uow:
            previous = await uow.physical_event_result(idempotency_key)
            if previous is not None:
                accepted, moment_id = previous
                return ButtonPressResult(accepted, "already_processed", moment_id=moment_id)
            space_id = await uow.resolve_device_space(device_id)
            if not space_id:
                await uow.record_physical_event(device_id, occurred_at, idempotency_key, False)
                await uow.commit()
                return ButtonPressResult(False, "unknown_device")
            session = await uow.active_session_for_space(space_id, occurred_at)
            if not session:
                await uow.record_physical_event(device_id, occurred_at, idempotency_key, False)
                await uow.commit()
                return ButtonPressResult(False, "no_active_session")
            moment = Moment(session.id, space_id, occurred_at)
            await uow.record_physical_event(
                device_id, occurred_at, idempotency_key, True, moment.id
            )
            await uow.add_moment(moment)
            await uow.add_timeline(session.id, "MomentRequested", occurred_at, {"momentId": str(moment.id)})
            await uow.add_outbox(
                "ReplayRequested",
                moment.id,
                {"momentId": str(moment.id), "sessionId": str(session.id), "spaceId": str(space_id)},
            )
            await uow.commit()
            return ButtonPressResult(True, "moment_requested", moment.id, session.id)


class ArenaInfrastructureService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    async def create_client(self, name: str) -> UUID:
        name = name.strip()
        if not name:
            raise ValueError("Nome do Cliente é obrigatório")
        async with self._uow_factory() as uow:
            entity_id = await uow.add_client(name)
            await uow.commit()
            return entity_id

    async def create_space(self, name: str) -> UUID:
        name = name.strip()
        if not name:
            raise ValueError("Nome do Espaço é obrigatório")
        async with self._uow_factory() as uow:
            entity_id = await uow.add_space(name)
            await uow.commit()
            return entity_id

    async def update_space(self, space_id: UUID, name: str, administrative_status: str) -> dict:
        name = name.strip()
        if not name:
            raise ValueError("Nome do Espaço é obrigatório")
        if administrative_status not in {"active", "maintenance", "disabled"}:
            raise ValueError("Estado administrativo do Espaço é inválido")
        async with self._uow_factory() as uow:
            if not await uow.get_space(space_id, lock=True):
                raise EntityNotFound("Espaço não encontrado")
            space = await uow.update_space(space_id, name, administrative_status)
            await uow.commit()
            return space

    async def delete_space(self, space_id: UUID) -> None:
        async with self._uow_factory() as uow:
            if not await uow.get_space(space_id, lock=True):
                raise EntityNotFound("Espaço não encontrado")
            if await uow.space_has_dependencies(space_id):
                raise SpaceInUse("Espaço possui Sessões ou Equipamentos vinculados")
            await uow.delete_space(space_id)
            await uow.commit()

    async def create_equipment(
        self, space_id: UUID, kind: str, external_id: str, configuration: dict
    ) -> UUID:
        external_id = self._validate_equipment(kind, external_id, configuration)
        async with self._uow_factory() as uow:
            if not await uow.get_space(space_id):
                raise EntityNotFound("Espaço não encontrado")
            entity_id = await uow.add_equipment(space_id, kind, external_id, configuration)
            await uow.commit()
            return entity_id

    async def update_equipment(
        self, equipment_id: UUID, space_id: UUID, kind: str, external_id: str, configuration: dict, administrative_status: str = "active"
    ) -> dict:
        external_id = self._validate_equipment(kind, external_id, configuration)
        self._validate_binary_status(administrative_status, "Equipamento")
        async with self._uow_factory() as uow:
            if not await uow.get_equipment(equipment_id, lock=True):
                raise EntityNotFound("Equipamento não encontrado")
            if not await uow.get_space(space_id):
                raise EntityNotFound("Espaço não encontrado")
            equipment = await uow.update_equipment(
                equipment_id, space_id, kind, external_id, configuration, administrative_status
            )
            await uow.commit()
            return equipment

    async def delete_equipment(self, equipment_id: UUID) -> None:
        async with self._uow_factory() as uow:
            if not await uow.get_equipment(equipment_id, lock=True):
                raise EntityNotFound("Equipamento não encontrado")
            await uow.delete_equipment(equipment_id)
            await uow.commit()

    @staticmethod
    def _validate_equipment(kind: str, external_id: str, configuration: dict) -> str:
        if kind not in {"camera", "ax_device"}:
            raise ValueError("Tipo do Equipamento deve ser camera ou ax_device")
        external_id = external_id.strip()
        if not external_id:
            raise ValueError("Identificador externo do Equipamento é obrigatório")
        if not isinstance(configuration, dict):
            raise ValueError("Configuração do Equipamento deve ser um objeto")
        if kind == "camera" and not str(configuration.get("capture_url", "")).strip():
            raise ValueError("URL de captura da Câmera é obrigatória")
        return external_id

    async def list_clients(self) -> list[dict]:
        async with self._uow_factory() as uow:
            return await uow.list_clients()

    async def update_client(self, client_id: UUID, name: str, administrative_status: str = "active") -> dict:
        name = name.strip()
        if not name:
            raise ValueError("Nome do Cliente é obrigatório")
        self._validate_binary_status(administrative_status, "Cliente")
        async with self._uow_factory() as uow:
            if not await uow.get_client(client_id, lock=True):
                raise EntityNotFound("Cliente não encontrado")
            client = await uow.update_client(client_id, name, administrative_status)
            await uow.commit()
            return client

    async def delete_client(self, client_id: UUID) -> None:
        async with self._uow_factory() as uow:
            if not await uow.get_client(client_id, lock=True):
                raise EntityNotFound("Cliente não encontrado")
            if await uow.client_has_sessions(client_id):
                raise ClientInUse("Cliente é Responsável por uma ou mais Sessões")
            await uow.delete_client(client_id)
            await uow.commit()

    async def list_spaces(self) -> list[dict]:
        async with self._uow_factory() as uow:
            return await uow.list_spaces()

    async def list_equipments(self, space_id: UUID | None = None) -> list[dict]:
        async with self._uow_factory() as uow:
            return await uow.list_equipments(space_id)

    @staticmethod
    def _validate_binary_status(status: str, entity: str) -> None:
        if status not in {"active", "inactive"}:
            raise ValueError(f"Estado administrativo do {entity} é inválido")
