from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from arenax.application.use_cases import PhysicalEventService
from arenax.domain.session import Session, SessionStatus

NOW = datetime(2026, 8, 7, 21, tzinfo=timezone.utc)


class FakeUow:
    def __init__(self, device_space=None, active_session=None):
        self.device_space = device_space
        self.active_session = active_session
        self.events = {}
        self.moments, self.timeline, self.outbox = [], [], []

    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def physical_event_result(self, key): return self.events.get(key)
    async def resolve_device_space(self, _): return self.device_space
    async def active_session_for_space(self, *_): return self.active_session
    async def record_physical_event(self, device_id, at, key, accepted, moment_id=None):
        self.events[key] = (accepted, moment_id)
    async def add_moment(self, moment): self.moments.append(moment)
    async def add_timeline(self, *entry): self.timeline.append(entry)
    async def add_outbox(self, *entry): self.outbox.append(entry)
    async def commit(self): pass


@pytest.mark.asyncio
async def test_unknown_device_is_audited_without_moment():
    uow = FakeUow()
    result = await PhysicalEventService(lambda: uow).button_pressed("AX-X", NOW, "event-0001")
    assert not result.accepted
    assert result.reason == "unknown_device"
    assert not uow.moments and not uow.outbox


@pytest.mark.asyncio
async def test_active_session_creates_moment_timeline_and_outbox_once():
    space_id = uuid4()
    session = Session(uuid4(), (space_id,), NOW - timedelta(minutes=5), NOW + timedelta(hours=1),
                      status=SessionStatus.IN_PROGRESS, actual_start=NOW - timedelta(minutes=5))
    uow = FakeUow(space_id, session)
    service = PhysicalEventService(lambda: uow)
    first = await service.button_pressed("AX-001", NOW, "event-0002")
    second = await service.button_pressed("AX-001", NOW, "event-0002")
    assert first.accepted and second.reason == "already_processed"
    assert len(uow.moments) == len(uow.timeline) == len(uow.outbox) == 1

