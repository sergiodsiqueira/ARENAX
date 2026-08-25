from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update

from arenax.domain.identity import User, UserRole, UserStatus
from arenax.domain.moment import Moment
from arenax.domain.session import BLOCKING_STATUSES, Session, SessionStatus

from .database import session_factory
from .models import (
    AccessModel,
    EquipmentModel,
    MomentModel,
    OutboxModel,
    ClientModel,
    PhysicalEventModel,
    SessionModel,
    SessionSpaceModel,
    SpaceModel,
    TimelineModel,
    UserModel,
)


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

    async def spaces_are_active(self, space_ids: tuple[UUID, ...]) -> bool:
        active_count = await self.session.scalar(
            select(func.count()).select_from(SpaceModel).where(
                SpaceModel.id.in_(space_ids),
                SpaceModel.administrative_status == "active",
            )
        )
        return active_count == len(space_ids)

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

    async def session_has_associated_events(self, session_id: UUID) -> bool:
        timeline_event = await self.session.scalar(
            select(TimelineModel.id).where(
                TimelineModel.session_id == session_id,
                TimelineModel.kind != "SessionCreated",
            ).limit(1)
        )
        if timeline_event is not None:
            return True
        moment = await self.session.scalar(
            select(MomentModel.id).where(MomentModel.session_id == session_id).limit(1)
        )
        return moment is not None

    async def delete_session(self, session_id: UUID) -> None:
        await self.session.execute(
            delete(TimelineModel).where(TimelineModel.session_id == session_id)
        )
        await self.session.execute(
            delete(SessionSpaceModel).where(SessionSpaceModel.session_id == session_id)
        )
        model = await self.session.get(SessionModel, session_id)
        if model is not None:
            await self.session.delete(model)

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

    async def add_client(self, name: str) -> UUID:
        model = ClientModel(name=name)
        self.session.add(model)
        await self.session.flush()
        return model.id

    async def add_space(self, name: str) -> UUID:
        model = SpaceModel(name=name)
        self.session.add(model)
        await self.session.flush()
        return model.id

    async def get_space(self, space_id: UUID, *, lock: bool = False) -> dict | None:
        query = select(SpaceModel).where(SpaceModel.id == space_id)
        model = await self.session.scalar(query.with_for_update() if lock else query)
        return {"id": model.id, "name": model.name, "administrative_status": model.administrative_status} if model else None

    async def update_space(self, space_id: UUID, name: str, administrative_status: str) -> dict:
        model = await self.session.get(SpaceModel, space_id)
        model.name, model.administrative_status = name, administrative_status
        await self.session.flush()
        return {"id": model.id, "name": model.name, "administrative_status": model.administrative_status}

    async def space_has_dependencies(self, space_id: UUID) -> bool:
        session_exists = await self.session.scalar(select(SessionSpaceModel.session_id).where(SessionSpaceModel.space_id == space_id).limit(1))
        equipment_exists = await self.session.scalar(select(EquipmentModel.id).where(EquipmentModel.space_id == space_id).limit(1))
        return session_exists is not None or equipment_exists is not None

    async def delete_space(self, space_id: UUID) -> None:
        model = await self.session.get(SpaceModel, space_id)
        await self.session.delete(model)

    async def add_equipment(self, space_id, kind, external_id, configuration) -> UUID:
        model = EquipmentModel(space_id=space_id, kind=kind, external_id=external_id,
                               configuration=configuration)
        self.session.add(model)
        await self.session.flush()
        return model.id

    async def get_equipment(self, equipment_id: UUID, *, lock: bool = False) -> dict | None:
        query = select(EquipmentModel).where(EquipmentModel.id == equipment_id)
        model = await self.session.scalar(query.with_for_update() if lock else query)
        return self._equipment_projection(model) if model else None

    async def update_equipment(
        self, equipment_id: UUID, space_id: UUID, kind: str, external_id: str, configuration: dict, administrative_status: str
    ) -> dict:
        model = await self.session.get(EquipmentModel, equipment_id)
        model.space_id = space_id
        model.kind = kind
        model.external_id = external_id
        model.configuration = configuration
        model.administrative_status = administrative_status
        await self.session.flush()
        return self._equipment_projection(model)

    async def delete_equipment(self, equipment_id: UUID) -> None:
        model = await self.session.get(EquipmentModel, equipment_id)
        await self.session.delete(model)

    async def list_clients(self) -> list[dict]:
        models = list(await self.session.scalars(select(ClientModel).order_by(ClientModel.name)))
        return [{"id": model.id, "name": model.name, "administrative_status": model.administrative_status} for model in models]

    async def get_client(self, client_id: UUID, *, lock: bool = False) -> dict | None:
        query = select(ClientModel).where(ClientModel.id == client_id)
        model = await self.session.scalar(query.with_for_update() if lock else query)
        return {"id": model.id, "name": model.name, "administrative_status": model.administrative_status} if model else None

    async def update_client(self, client_id: UUID, name: str, administrative_status: str) -> dict:
        model = await self.session.get(ClientModel, client_id)
        model.name = name
        model.administrative_status = administrative_status
        await self.session.flush()
        return {"id": model.id, "name": model.name, "administrative_status": model.administrative_status}

    async def client_has_sessions(self, client_id: UUID) -> bool:
        return await self.session.scalar(
            select(SessionModel.id).where(SessionModel.responsible_client_id == client_id).limit(1)
        ) is not None

    async def delete_client(self, client_id: UUID) -> None:
        model = await self.session.get(ClientModel, client_id)
        await self.session.delete(model)

    async def list_spaces(self) -> list[dict]:
        models = list(await self.session.scalars(select(SpaceModel).order_by(SpaceModel.name)))
        return [
            {
                "id": model.id,
                "name": model.name,
                "administrative_status": model.administrative_status,
            }
            for model in models
        ]

    async def list_equipments(self, space_id: UUID | None = None) -> list[dict]:
        query = select(EquipmentModel).order_by(EquipmentModel.kind, EquipmentModel.external_id)
        if space_id is not None:
            query = query.where(EquipmentModel.space_id == space_id)
        models = list(await self.session.scalars(query))
        return [self._equipment_projection(model) for model in models]

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
            "id": str(model.id), "responsible_client_id": str(model.responsible_client_id),
            "space_ids": [str(item) for item in spaces], "status": model.status,
            "scheduled_start": model.scheduled_start, "scheduled_end": model.scheduled_end,
            "actual_start": model.actual_start, "actual_end": model.actual_end,
            "moments": [{"id": str(item.id), "space_id": str(item.space_id),
                         "occurred_at": item.occurred_at, "status": item.status,
                         "replay_path": item.replay_path} for item in moments],
            "timeline": [{"kind": item.kind, "occurred_at": item.occurred_at,
                          "data": item.data} for item in timeline],
        }

    async def list_sessions(
        self, start: datetime, end: datetime, space_id: UUID | None = None
    ) -> list[Session]:
        query = (
            select(SessionModel)
            .where(
                SessionModel.scheduled_start < end,
                SessionModel.scheduled_end > start,
            )
            .order_by(SessionModel.scheduled_start, SessionModel.id)
        )
        if space_id is not None:
            query = query.join(SessionSpaceModel).where(SessionSpaceModel.space_id == space_id)
        return await self._hydrate_sessions(query)

    async def list_in_progress_sessions(self) -> list[Session]:
        query = (
            select(SessionModel)
            .where(SessionModel.status == SessionStatus.IN_PROGRESS.value)
            .order_by(SessionModel.actual_start, SessionModel.id)
        )
        return await self._hydrate_sessions(query)

    async def _hydrate_sessions(self, query) -> list[Session]:
        models = list(await self.session.scalars(query))
        if not models:
            return []
        session_ids = [model.id for model in models]
        rows = (await self.session.execute(
            select(SessionSpaceModel.session_id, SessionSpaceModel.space_id)
            .where(SessionSpaceModel.session_id.in_(session_ids))
            .order_by(SessionSpaceModel.session_id, SessionSpaceModel.space_id)
        )).all()
        spaces_by_session: dict[UUID, list[UUID]] = {session_id: [] for session_id in session_ids}
        for session_id, item_space_id in rows:
            spaces_by_session[session_id].append(item_space_id)
        return [
            self._to_domain(model, tuple(spaces_by_session[model.id])) for model in models
        ]

    async def get_user_by_email(self, email: str) -> User | None:
        model = await self.session.scalar(select(UserModel).where(UserModel.email == email))
        return self._user_to_domain(model) if model else None

    async def get_user_by_access(self, token_hash: str, now: datetime) -> User | None:
        model = await self.session.scalar(
            select(UserModel)
            .join(AccessModel, AccessModel.user_id == UserModel.id)
            .where(
                AccessModel.token_hash == token_hash,
                AccessModel.revoked_at.is_(None),
                AccessModel.expires_at > now,
            )
        )
        return self._user_to_domain(model) if model else None

    async def add_user(
        self, name: str, email: str, password_hash: str, role: UserRole, now: datetime
    ) -> User:
        model = UserModel(
            name=name,
            email=email,
            password_hash=password_hash,
            role=role.value,
            status=UserStatus.ACTIVE.value,
            created_at=now,
            updated_at=now,
        )
        self.session.add(model)
        await self.session.flush()
        return self._user_to_domain(model)

    async def add_access(
        self,
        user_id: UUID,
        token_hash: str,
        now: datetime,
        expires_at: datetime,
        persistent: bool,
    ) -> None:
        self.session.add(
            AccessModel(
                user_id=user_id,
                token_hash=token_hash,
                created_at=now,
                expires_at=expires_at,
                persistent=persistent,
            )
        )

    async def revoke_access(self, token_hash: str, now: datetime) -> None:
        access = await self.session.scalar(
            select(AccessModel).where(
                AccessModel.token_hash == token_hash,
                AccessModel.revoked_at.is_(None),
            )
        )
        if access:
            access.revoked_at = now

    async def register_last_access(self, user_id: UUID, now: datetime) -> None:
        user = await self.session.get(UserModel, user_id)
        if user:
            user.last_access_at = now
            user.updated_at = now

    async def list_users(self) -> list[User]:
        models = list(await self.session.scalars(select(UserModel).order_by(UserModel.name, UserModel.id)))
        return [self._user_to_domain(model) for model in models]

    async def get_user(self, user_id: UUID, *, lock: bool = False) -> User | None:
        query = select(UserModel).where(UserModel.id == user_id)
        model = await self.session.scalar(query.with_for_update() if lock else query)
        return self._user_to_domain(model) if model else None

    async def update_user(self, user_id, role, status, now) -> User:
        model = await self.session.get(UserModel, user_id)
        model.role, model.status, model.updated_at = role.value, status.value, now
        await self.session.flush()
        return self._user_to_domain(model)

    async def update_user_password(self, user_id, password_hash, now) -> None:
        model = await self.session.get(UserModel, user_id)
        model.password_hash, model.updated_at = password_hash, now

    async def revoke_user_accesses(self, user_id, now) -> None:
        await self.session.execute(update(AccessModel).where(
            AccessModel.user_id == user_id, AccessModel.revoked_at.is_(None)
        ).values(revoked_at=now))

    async def count_active_owners(self) -> int:
        return int(await self.session.scalar(select(func.count()).select_from(UserModel).where(
            UserModel.role == UserRole.OWNER.value,
            UserModel.status == UserStatus.ACTIVE.value,
        )) or 0)

    async def get_moment_replay_path(self, moment_id: UUID) -> str | None:
        return await self.session.scalar(select(MomentModel.replay_path).where(MomentModel.id == moment_id))

    @staticmethod
    def _to_model(item: Session) -> SessionModel:
        return SessionModel(id=item.id, responsible_client_id=item.responsible_client_id,
            status=item.status.value, scheduled_start=item.scheduled_start,
            scheduled_end=item.scheduled_end, actual_start=item.actual_start,
            actual_end=item.actual_end)

    @staticmethod
    def _to_domain(model: SessionModel, spaces: tuple[UUID, ...]) -> Session:
        return Session(id=model.id, responsible_client_id=model.responsible_client_id,
            space_ids=spaces, scheduled_start=model.scheduled_start,
            scheduled_end=model.scheduled_end, status=SessionStatus(model.status),
            actual_start=model.actual_start, actual_end=model.actual_end)

    @staticmethod
    def _user_to_domain(model: UserModel) -> User:
        return User(
            id=model.id,
            name=model.name,
            email=model.email,
            password_hash=model.password_hash,
            role=UserRole(model.role),
            status=UserStatus(model.status),
            created_at=model.created_at,
            updated_at=model.updated_at,
            last_access_at=model.last_access_at,
        )

    @staticmethod
    def _equipment_projection(model: EquipmentModel) -> dict:
        return {
            "id": model.id,
            "space_id": model.space_id,
            "kind": model.kind,
            "external_id": model.external_id,
            "configuration": model.configuration,
            "administrative_status": model.administrative_status,
        }
