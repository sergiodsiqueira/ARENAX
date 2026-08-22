from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from .errors import InvalidSessionTransition


class SessionStatus(StrEnum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


BLOCKING_STATUSES = {
    SessionStatus.SCHEDULED,
    SessionStatus.CONFIRMED,
    SessionStatus.IN_PROGRESS,
}


@dataclass(frozen=True, slots=True)
class DomainEvent:
    name: str
    occurred_at: datetime
    payload: dict[str, str]


@dataclass(slots=True)
class Session:
    responsible_client_id: UUID
    space_ids: tuple[UUID, ...]
    scheduled_start: datetime
    scheduled_end: datetime
    id: UUID = field(default_factory=uuid4)
    status: SessionStatus = SessionStatus.SCHEDULED
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    events: list[DomainEvent] = field(default_factory=list, repr=False)

    def __post_init__(self) -> None:
        if not self.space_ids:
            raise ValueError("A Session must contain at least one Space")
        if len(set(self.space_ids)) != len(self.space_ids):
            raise ValueError("A Space cannot be repeated in a Session")
        self._require_aware(self.scheduled_start)
        self._require_aware(self.scheduled_end)
        if self.scheduled_end <= self.scheduled_start:
            raise ValueError("scheduled_end must be after scheduled_start")

    def confirm(self, now: datetime) -> None:
        self._transition({SessionStatus.SCHEDULED}, SessionStatus.CONFIRMED, "SessionConfirmed", now)

    def start(self, now: datetime) -> None:
        self._require_aware(now)
        self._transition(
            {SessionStatus.SCHEDULED, SessionStatus.CONFIRMED},
            SessionStatus.IN_PROGRESS,
            "SessionStarted",
            now,
        )
        self.actual_start = now

    def extend(self, new_end: datetime, now: datetime) -> None:
        self._require_aware(new_end)
        if self.status is not SessionStatus.IN_PROGRESS:
            raise InvalidSessionTransition("Only an in-progress Session can be extended")
        if new_end <= self.scheduled_end:
            raise ValueError("The new end must extend the current period")
        self.scheduled_end = new_end
        self._record("SessionExtended", now)

    def finish(self, now: datetime) -> None:
        self._require_aware(now)
        self._transition({SessionStatus.IN_PROGRESS}, SessionStatus.FINISHED, "SessionFinished", now)
        self.actual_end = now

    def cancel(self, now: datetime) -> None:
        self._transition(
            {SessionStatus.SCHEDULED, SessionStatus.CONFIRMED, SessionStatus.IN_PROGRESS},
            SessionStatus.CANCELLED,
            "SessionCancelled",
            now,
        )
        if self.actual_start:
            self.actual_end = now

    def mark_no_show(self, now: datetime) -> None:
        self._transition(
            {SessionStatus.SCHEDULED, SessionStatus.CONFIRMED},
            SessionStatus.NO_SHOW,
            "SessionMarkedNoShow",
            now,
        )

    def _transition(
        self, allowed: set[SessionStatus], target: SessionStatus, event: str, now: datetime
    ) -> None:
        self._require_aware(now)
        if self.status not in allowed:
            raise InvalidSessionTransition(f"Cannot change Session from {self.status} to {target}")
        self.status = target
        self._record(event, now)

    def _record(self, name: str, now: datetime) -> None:
        self.events.append(DomainEvent(name, now, {"sessionId": str(self.id)}))

    @staticmethod
    def _require_aware(value: datetime) -> None:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("All instants must include a timezone")


def periods_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    """Return overlap for half-open intervals [start, end)."""
    return start_a < end_b and start_b < end_a
