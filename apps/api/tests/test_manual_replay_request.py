from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from arenax.application.use_cases import SessionService
from arenax.domain.session import Session, SessionStatus


NOW = datetime(2026, 9, 12, 18, 30, tzinfo=UTC)


class ReplayRequestUnitOfWork:
    def __init__(self, session):
        self.session = session
        self.moments = []
        self.timeline = []
        self.outbox = []
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get_session(self, _session_id, *, lock=False):
        self.locked = lock
        return self.session

    async def add_moment(self, moment):
        self.moments.append(moment)

    async def add_timeline(self, *entry):
        self.timeline.append(entry)

    async def add_outbox(self, *entry):
        self.outbox.append(entry)

    async def commit(self):
        self.committed = True


def make_session(space_id, status=SessionStatus.IN_PROGRESS):
    return Session(
        uuid4(),
        (space_id,),
        NOW - timedelta(minutes=10),
        NOW + timedelta(minutes=50),
        status=status,
        actual_start=NOW - timedelta(minutes=10) if status == SessionStatus.IN_PROGRESS else None,
    )


@pytest.mark.asyncio
async def test_manual_replay_request_creates_pending_moment_timeline_and_outbox():
    space_id = uuid4()
    session = make_session(space_id)
    uow = ReplayRequestUnitOfWork(session)

    moment = await SessionService(lambda: uow).request_replay(session.id, space_id, NOW)

    assert moment.session_id == session.id
    assert moment.space_id == space_id
    assert moment.status == "requested"
    assert uow.moments == [moment]
    assert uow.timeline == [
        (session.id, "MomentRequested", NOW, {"momentId": str(moment.id)})
    ]
    assert uow.outbox == [
        (
            "ReplayRequested",
            moment.id,
            {
                "momentId": str(moment.id),
                "sessionId": str(session.id),
                "spaceId": str(space_id),
            },
        )
    ]
    assert uow.committed


@pytest.mark.asyncio
async def test_manual_replay_request_rejects_space_outside_session():
    space_id = uuid4()
    session = make_session(space_id)
    uow = ReplayRequestUnitOfWork(session)

    with pytest.raises(ValueError, match="Espaço não pertence"):
        await SessionService(lambda: uow).request_replay(session.id, uuid4(), NOW)

    assert not uow.moments
    assert not uow.committed


@pytest.mark.asyncio
async def test_manual_replay_request_requires_in_progress_session():
    space_id = uuid4()
    session = make_session(space_id, SessionStatus.CONFIRMED)
    uow = ReplayRequestUnitOfWork(session)

    with pytest.raises(ValueError, match="em andamento"):
        await SessionService(lambda: uow).request_replay(session.id, space_id, NOW)

    assert not uow.moments
    assert not uow.committed
