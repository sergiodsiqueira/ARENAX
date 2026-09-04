from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from arenax.application.use_cases import SessionService
from arenax.domain.errors import InactiveSpace


NOW = datetime(2026, 8, 21, 20, tzinfo=UTC)


class CreationUnitOfWork:
    def __init__(self, spaces_active: bool):
        self.spaces_active = spaces_active
        self.added = False
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def lock_spaces(self, _space_ids):
        return None

    async def spaces_are_active(self, _space_ids):
        return self.spaces_active

    async def has_conflict(self, *_args, **_kwargs):
        return False

    async def add_session(self, _session):
        self.added = True

    async def add_timeline(self, *_entry):
        return None

    async def commit(self):
        self.committed = True


@pytest.mark.asyncio
async def test_session_can_only_be_scheduled_in_active_spaces():
    uow = CreationUnitOfWork(spaces_active=False)
    service = SessionService(lambda: uow)

    with pytest.raises(InactiveSpace, match="Only active Spaces"):
        await service.create(
            uuid4(),
            (uuid4(),),
            NOW + timedelta(hours=1),
            NOW + timedelta(hours=2),
            NOW,
        )

    assert not uow.added
    assert not uow.committed


@pytest.mark.asyncio
async def test_session_is_created_when_all_spaces_are_active():
    uow = CreationUnitOfWork(spaces_active=True)
    service = SessionService(lambda: uow)

    await service.create(
        uuid4(),
        (uuid4(),),
        NOW + timedelta(hours=1),
        NOW + timedelta(hours=2),
        NOW,
    )

    assert uow.added and uow.committed
