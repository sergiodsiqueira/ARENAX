from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from arenax.application.use_cases import SessionService
from arenax.domain.session import Session, SessionStatus


NOW = datetime(2026, 8, 21, 18, tzinfo=UTC)


class CancellationUnitOfWork:
    def __init__(self, session: Session, has_events: bool):
        self.session = session
        self.has_events = has_events
        self.deleted = False
        self.saved = False
        self.timeline = []
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get_session(self, *_args, **_kwargs):
        return self.session

    async def lock_spaces(self, _space_ids):
        return None

    async def session_has_associated_events(self, _session_id):
        return self.has_events

    async def delete_session(self, _session_id):
        self.deleted = True

    async def save_session(self, _session):
        self.saved = True

    async def add_timeline(self, *entry):
        self.timeline.append(entry)

    async def commit(self):
        self.committed = True


def scheduled_session():
    return Session(uuid4(), (uuid4(),), NOW + timedelta(hours=1), NOW + timedelta(hours=2))


@pytest.mark.asyncio
async def test_cancel_deletes_untouched_agenda():
    uow = CancellationUnitOfWork(scheduled_session(), has_events=False)

    result = await SessionService(lambda: uow).transition(uow.session.id, "cancel", NOW)

    assert result is None
    assert uow.deleted and uow.committed
    assert not uow.saved and not uow.timeline


@pytest.mark.asyncio
async def test_cancel_preserves_session_with_associated_events():
    uow = CancellationUnitOfWork(scheduled_session(), has_events=True)

    result = await SessionService(lambda: uow).transition(uow.session.id, "cancel", NOW)

    assert result is uow.session
    assert result.status is SessionStatus.CANCELLED
    assert uow.saved and uow.committed and len(uow.timeline) == 1
    assert not uow.deleted
