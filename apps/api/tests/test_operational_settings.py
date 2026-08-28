from datetime import UTC, datetime

import pytest

from arenax.application.use_cases import ArenaInfrastructureService

NOW = datetime(2026, 8, 26, 18, tzinfo=UTC)


class SettingsUnitOfWork:
    def __init__(self):
        self.settings = {
            "default_session_duration_minutes": 60,
            "replay_pre_duration_seconds": 30,
            "replay_post_duration_seconds": 5,
            "calculate_actual_time": True,
            "updated_at": NOW,
        }
        self.locked = self.committed = False

    async def __aenter__(self): return self
    async def __aexit__(self, *_): return None
    async def get_operational_settings(self, *, lock=False):
        self.locked = lock
        return self.settings
    async def update_operational_settings(self, session_minutes, pre_seconds, post_seconds, calculate_actual_time, now):
        self.settings = {
            "default_session_duration_minutes": session_minutes,
            "replay_pre_duration_seconds": pre_seconds,
            "replay_post_duration_seconds": post_seconds,
            "calculate_actual_time": calculate_actual_time,
            "updated_at": now,
        }
        return self.settings
    async def commit(self): self.committed = True


@pytest.mark.asyncio
async def test_reads_operational_settings():
    uow = SettingsUnitOfWork()
    result = await ArenaInfrastructureService(lambda: uow).get_operational_settings()
    assert result["default_session_duration_minutes"] == 60
    assert not uow.locked


@pytest.mark.asyncio
async def test_updates_operational_settings_atomically():
    uow = SettingsUnitOfWork()
    result = await ArenaInfrastructureService(lambda: uow).update_operational_settings(90, 20, 10, False, NOW)
    assert result["replay_pre_duration_seconds"] == 20
    assert result["calculate_actual_time"] is False
    assert uow.locked and uow.committed


@pytest.mark.asyncio
@pytest.mark.parametrize("values", [(0, 30, 5), (60, -1, 5), (60, 0, 0)])
async def test_rejects_invalid_operational_settings(values):
    with pytest.raises(ValueError):
        await ArenaInfrastructureService(lambda: SettingsUnitOfWork()).update_operational_settings(*values, True, NOW)
