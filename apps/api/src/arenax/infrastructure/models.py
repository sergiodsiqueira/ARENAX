from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class PersonModel(Base):
    __tablename__ = "people"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160))


class SpaceModel(Base):
    __tablename__ = "spaces"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    administrative_status: Mapped[str] = mapped_column(String(30), default="active")


class EquipmentModel(Base):
    __tablename__ = "equipments"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    space_id: Mapped[UUID] = mapped_column(ForeignKey("spaces.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    external_id: Mapped[str] = mapped_column(String(100), unique=True)
    configuration: Mapped[dict] = mapped_column(JSON, default=dict)


class SessionModel(Base):
    __tablename__ = "sessions"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    responsible_person_id: Mapped[UUID] = mapped_column(ForeignKey("people.id"))
    status: Mapped[str] = mapped_column(String(30), index=True)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SessionSpaceModel(Base):
    __tablename__ = "session_spaces"
    session_id: Mapped[UUID] = mapped_column(ForeignKey("sessions.id"), primary_key=True)
    space_id: Mapped[UUID] = mapped_column(ForeignKey("spaces.id"), primary_key=True, index=True)


class PhysicalEventModel(Base):
    __tablename__ = "physical_events"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    device_id: Mapped[str] = mapped_column(String(100), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True)
    accepted: Mapped[bool] = mapped_column(Boolean)
    moment_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))


class MomentModel(Base):
    __tablename__ = "moments"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    session_id: Mapped[UUID] = mapped_column(ForeignKey("sessions.id"), index=True)
    space_id: Mapped[UUID] = mapped_column(ForeignKey("spaces.id"))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30))
    replay_path: Mapped[str | None] = mapped_column(String(500))


class TimelineModel(Base):
    __tablename__ = "timeline"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(ForeignKey("sessions.id"), index=True)
    kind: Mapped[str] = mapped_column(String(80))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class OutboxModel(Base):
    __tablename__ = "outbox"
    __table_args__ = (UniqueConstraint("kind", "aggregate_id"),)
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(String(80))
    aggregate_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    payload: Mapped[dict] = mapped_column(JSON)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

