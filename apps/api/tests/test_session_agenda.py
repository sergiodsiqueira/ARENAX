from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from arenax.application.use_cases import SessionService
from arenax.domain.session import Session

NOW = datetime(2026, 8, 19, 12, tzinfo=UTC)


class AgendaUnitOfWork:
    def __init__(self, sessions):
        self.sessions = sessions
        self.query = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def list_sessions(self, start, end, space_id=None):
        self.query = (start, end, space_id)
        return self.sessions


@pytest.mark.asyncio
async def test_agenda_delegates_temporal_projection_to_repository():
    space_id = uuid4()
    expected = [Session(uuid4(), (space_id,), NOW, NOW + timedelta(hours=1))]
    uow = AgendaUnitOfWork(expected)
    service = SessionService(lambda: uow)

    result = await service.agenda(NOW, NOW + timedelta(days=1), space_id)

    assert result == expected
    assert uow.query == (NOW, NOW + timedelta(days=1), space_id)


@pytest.mark.asyncio
async def test_agenda_rejects_invalid_or_timezone_naive_window():
    service = SessionService(lambda: AgendaUnitOfWork([]))

    with pytest.raises(ValueError, match="end must be after start"):
        await service.agenda(NOW, NOW)
    with pytest.raises(ValueError, match="timezone"):
        await service.agenda(NOW.replace(tzinfo=None), NOW + timedelta(hours=1))
