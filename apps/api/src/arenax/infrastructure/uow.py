from datetime import datetime
from uuid import UUID

from sqlalchemy import or_, select

from arenax.domain.moment import Moment
from arenax.domain.session import BLOCKING_STATUSES, Session, SessionStatus
from .database import session_factory
from .models import EquipmentModel, MomentModel, OutboxModel, PersonModel, PhysicalEventModel
from .models import SessionModel, SessionSpaceModel, SpaceModel, TimelineModel


class SqlAlchemyUnitOfWork:
    def __init__(self):
        self.session = session_factory()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if exc_type:
            await self.session.rollback()
        await self.session.close()

    async def lock_spaces(self, space_ids: tuple[UUID, ...]) -> None:
        rows = list(await self.session.scalars(
            select(SpaceModel.id).where(SpaceModel.id.in_(space_ids))
            .order_by(SpaceModel.id).with_for_update()
        ))
        if len(rows) != len(space_ids):
            raise ValueError("One or more Spaces do not exist")

    async def has_conflict(self, space_ids, start, end, exclude=None) -> bool:
        query = select(SessionModel.id).join(SessionSpaceModel).where(
            SessionSpaceModel.space_id.in_(space_ids),
            SessionModel.status.in_([item.value for item in BLOCKING_STATUSES]),
            SessionModel.scheduled_start < end,
            SessionModel.scheduled_end > start,
        ).limit(1)
        if exclude:
            query = query.where(SessionModel.id != exclude)
        return await self.session.scalar(query) is not None

    async def add_session(self, domain: Session) -> None:
        self.session.add(self._to_model(domain))
        self.session.add_all(SessionSpaceModel(session_id=domain.id, space_id=item)
                             for item in domain.space_ids)

    async def get_session(self, session_id: UUID, *, lock=False) -> Session | None:
        query = select(SessionModel).where(SessionModel.id == session_id)
        model = await self.session.scalar(query.with_for_update() if lock else query)
        if not model:
            return None
        spaces = tuple(await self.session.scalars(
            select(SessionSpaceModel.space_id).where(SessionSpaceModel.session_id == session_id)
        ))
        return self._to_domain(model, spaces)

    async def save_session(self, domain: Session) -> None:
        model = await self.session.get(SessionModel, domain.id)
        model.status, model.scheduled_end = domain.status.value, domain.scheduled_end
        model.actual_start, model.actual_end = domain.actual_start, domain.actual_end

    async def resolve_device_space(self, device_id: str) -> UUID | None:
        return await self.session.scalar(select(EquipmentModel.space_id).where(
            EquipmentModel.external_id == device_id, EquipmentModel.kind == "ax_device"))

    async def active_session_for_space(self, space_id: UUID, at: datetime) -> Session | None:
        model = await self.session.scalar(select(SessionModel).join(SessionSpaceModel).where(
            SessionSpaceModel.space_id == space_id,
            SessionModel.status == SessionStatus.IN_PROGRESS.value,
            SessionModel.actual_start <= at,
            or_(SessionModel.actual_end.is_(None), SessionModel.actual_end >= at),
        ).limit(1))
        if not model:
            return None
        spaces = tuple(await self.session.scalars(select(SessionSpaceModel.space_id).where(
            SessionSpaceModel.session_id == model.id)))
        return self._to_domain(model, spaces)

    async def physical_event_result(self, key: str) -> tuple[bool, UUID | None] | None:
        row = (await self.session.execute(select(
            PhysicalEventModel.accepted, PhysicalEventModel.moment_id
        ).where(PhysicalEventModel.idempotency_key == key))).one_or_none()
        return (row.accepted, row.moment_id) if row else None

    async def record_physical_event(self, device_id, occurred_at, idempotency_key,
                                    accepted, moment_id=None) -> None:
        self.session.add(PhysicalEventModel(device_id=device_id, occurred_at=occurred_at,
                         idempotency_key=idempotency_key, accepted=accepted, moment_id=moment_id))

    async def add_moment(self, moment: Moment) -> None:
        self.session.add(MomentModel(id=moment.id, session_id=moment.session_id,
                         space_id=moment.space_id, occurred_at=moment.occurred_at,
                         status=moment.status.value))

    async def add_timeline(self, session_id, kind, at, data) -> None:
        self.session.add(TimelineModel(session_id=session_id, kind=kind, occurred_at=at, data=data))

    async def add_outbox(self, kind, aggregate_id, payload) -> None:
        self.session.add(OutboxModel(kind=kind, aggregate_id=aggregate_id, payload=payload))

    async def commit(self) -> None:
        await self.session.commit()

    async def add_person(self, name: str) -> UUID:
        model = PersonModel(name=name)
        self.session.add(model)
        await self.session.flush()
        return model.id

    async def add_space(self, name: str) -> UUID:
        model = SpaceModel(name=name)
        self.session.add(model)
        await self.session.flush()
        return model.id

    async def add_equipment(self, space_id, kind, external_id, configuration) -> UUID:
        model = EquipmentModel(space_id=space_id, kind=kind, external_id=external_id,
                               configuration=configuration)
        self.session.add(model)
        await self.session.flush()
        return model.id

    async def session_dossier(self, session_id: UUID) -> dict | None:
        model = await self.session.get(SessionModel, session_id)
        if not model:
            return None
        spaces = list(await self.session.scalars(select(SessionSpaceModel.space_id).where(
            SessionSpaceModel.session_id == session_id)))
        moments = list(await self.session.scalars(select(MomentModel).where(
            MomentModel.session_id == session_id).order_by(MomentModel.occurred_at)))
        timeline = list(await self.session.scalars(select(TimelineModel).where(
            TimelineModel.session_id == session_id).order_by(TimelineModel.occurred_at)))
        return {
            "id": str(model.id), "responsible_person_id": str(model.responsible_person_id),
            "space_ids": [str(item) for item in spaces], "status": model.status,
            "scheduled_start": model.scheduled_start, "scheduled_end": model.scheduled_end,
            "actual_start": model.actual_start, "actual_end": model.actual_end,
            "moments": [{"id": str(item.id), "space_id": str(item.space_id),
                         "occurred_at": item.occurred_at, "status": item.status,
                         "replay_path": item.replay_path} for item in moments],
            "timeline": [{"kind": item.kind, "occurred_at": item.occurred_at,
                          "data": item.data} for item in timeline],
        }

    @staticmethod
    def _to_model(item: Session) -> SessionModel:
        return SessionModel(id=item.id, responsible_person_id=item.responsible_person_id,
            status=item.status.value, scheduled_start=item.scheduled_start,
            scheduled_end=item.scheduled_end, actual_start=item.actual_start,
            actual_end=item.actual_end)

    @staticmethod
    def _to_domain(model: SessionModel, spaces: tuple[UUID, ...]) -> Session:
        return Session(id=model.id, responsible_person_id=model.responsible_person_id,
            space_ids=spaces, scheduled_start=model.scheduled_start,
            scheduled_end=model.scheduled_end, status=SessionStatus(model.status),
            actual_start=model.actual_start, actual_end=model.actual_end)
