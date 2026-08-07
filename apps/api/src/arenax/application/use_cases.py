from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from arenax.domain.errors import EntityNotFound, SessionConflict
from arenax.domain.moment import Moment
from arenax.domain.session import Session

from .ports import UnitOfWork


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
        responsible_person_id: UUID,
        space_ids: tuple[UUID, ...],
        start: datetime,
        end: datetime,
        now: datetime,
    ) -> Session:
        session = Session(responsible_person_id, space_ids, start, end)
        session._record("SessionCreated", now)
        async with self._uow_factory() as uow:
            await uow.lock_spaces(space_ids)
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

    async def transition(self, session_id: UUID, action: str, now: datetime, new_end=None) -> Session:
        async with self._uow_factory() as uow:
            session = await uow.get_session(session_id, lock=True)
            if not session:
                raise EntityNotFound("Session not found")
            await uow.lock_spaces(session.space_ids)
            if action == "start":
                session.start(now)
            elif action == "finish":
                session.finish(now)
            elif action == "cancel":
                session.cancel(now)
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

    async def create_person(self, name: str) -> UUID:
        async with self._uow_factory() as uow:
            entity_id = await uow.add_person(name)
            await uow.commit()
            return entity_id

    async def create_space(self, name: str) -> UUID:
        async with self._uow_factory() as uow:
            entity_id = await uow.add_space(name)
            await uow.commit()
            return entity_id

    async def create_equipment(
        self, space_id: UUID, kind: str, external_id: str, configuration: dict
    ) -> UUID:
        if kind not in {"camera", "ax_device"}:
            raise ValueError("Equipment kind must be camera or ax_device")
        async with self._uow_factory() as uow:
            entity_id = await uow.add_equipment(space_id, kind, external_id, configuration)
            await uow.commit()
            return entity_id
