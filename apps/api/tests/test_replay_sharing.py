from datetime import UTC, datetime
from uuid import uuid4

import pytest

from arenax.application.use_cases import ReplaySharingService
from arenax.domain.errors import EntityNotFound

NOW = datetime(2026, 8, 30, 18, tzinfo=UTC)


class ReplayUnitOfWork:
    def __init__(self, replay=None):
        self.replay = replay
        self.timeline = None
        self.committed = False

    async def __aenter__(self): return self
    async def __aexit__(self, *_): return None
    async def get_moment_replay(self, _moment_id, *, lock=False):
        assert lock
        return self.replay
    async def add_timeline(self, *entry): self.timeline = entry
    async def commit(self): self.committed = True


@pytest.mark.asyncio
async def test_registers_replay_share_in_session_timeline():
    session_id, moment_id, user_id = uuid4(), uuid4(), uuid4()
    uow = ReplayUnitOfWork({
        "session_id": session_id, "status": "ready", "replay_path": "/media/replay.mp4"
    })

    result = await ReplaySharingService(lambda: uow).register_share(moment_id, user_id, NOW)

    assert result == session_id
    assert uow.timeline[:3] == (session_id, "ReplayShared", NOW)
    assert uow.timeline[3] == {"momentId": str(moment_id), "sharedBy": str(user_id)}
    assert uow.committed


@pytest.mark.asyncio
async def test_rejects_unavailable_replay():
    uow = ReplayUnitOfWork({"status": "expired", "replay_path": None})
    with pytest.raises(EntityNotFound):
        await ReplaySharingService(lambda: uow).register_share(uuid4(), uuid4(), NOW)
    assert not uow.committed
