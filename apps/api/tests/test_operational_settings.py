from datetime import UTC, datetime

import pytest

from arenax.application.use_cases import ArenaInfrastructureService

NOW = datetime(2026, 8, 26, 18, tzinfo=UTC)
COMPANY = {
    "company_tax_id": "SFORFB0FZKZA06",
    "company_legal_name": "Arena Exemplo Ltda",
    "company_trade_name": "Arena Exemplo",
    "company_address": "Rua Central, 100",
    "company_postal_code": "01001000",
    "company_city": "São Paulo",
    "company_state": "SP",
    "company_phone": "11999998888",
    "ax_device_network_interface_id": "12",
    "ax_device_network_interface_name": "Ethernet",
    "ax_device_network_address": "192.168.1.10",
}


class SettingsUnitOfWork:
    def __init__(self):
        self.settings = {
            "default_session_duration_minutes": 60,
            "replay_pre_duration_seconds": 30,
            "replay_post_duration_seconds": 5,
            "calculate_actual_time": True,
            "replay_retention_days": None,
            "updated_at": NOW,
        }
        self.locked = self.committed = False

    async def __aenter__(self): return self
    async def __aexit__(self, *_): return None
    async def get_operational_settings(self, *, lock=False):
        self.locked = lock
        return self.settings
    async def update_operational_settings(self, session_minutes, pre_seconds, post_seconds, calculate_actual_time, replay_retention_days, company, now):
        self.settings = {
            "default_session_duration_minutes": session_minutes,
            "replay_pre_duration_seconds": pre_seconds,
            "replay_post_duration_seconds": post_seconds,
            "calculate_actual_time": calculate_actual_time,
            "replay_retention_days": replay_retention_days,
            **company,
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
    result = await ArenaInfrastructureService(lambda: uow).update_operational_settings(90, 20, 10, False, 30, COMPANY, NOW)
    assert result["replay_pre_duration_seconds"] == 20
    assert result["calculate_actual_time"] is False
    assert result["replay_retention_days"] == 30
    assert result["ax_device_network_address"] == "192.168.1.10"
    assert uow.locked and uow.committed


@pytest.mark.asyncio
@pytest.mark.parametrize("values", [(0, 30, 5), (60, -1, 5), (60, 0, 0)])
async def test_rejects_invalid_operational_settings(values):
    with pytest.raises(ValueError):
        await ArenaInfrastructureService(lambda: SettingsUnitOfWork()).update_operational_settings(*values, True, None, {}, NOW)


@pytest.mark.asyncio
async def test_rejects_non_positive_replay_retention():
    with pytest.raises(ValueError):
        await ArenaInfrastructureService(lambda: SettingsUnitOfWork()).update_operational_settings(
            60, 30, 5, True, 0, {}, NOW
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("field,value", [("company_tax_id", "123"), ("company_phone", "11999"), ("company_postal_code", "123"), ("company_state", "S")])
async def test_rejects_invalid_company_identification(field, value):
    company = {**COMPANY, field: value}
    with pytest.raises(ValueError):
        await ArenaInfrastructureService(lambda: SettingsUnitOfWork()).update_operational_settings(
            60, 30, 5, True, None, company, NOW
        )


@pytest.mark.asyncio
async def test_normalizes_alphanumeric_company_tax_id():
    company = {**COMPANY, "company_tax_id": "sf.orf.b0f/zkza-06"}
    result = await ArenaInfrastructureService(lambda: SettingsUnitOfWork()).update_operational_settings(
        60, 30, 5, True, None, company, NOW
    )
    assert result["company_tax_id"] == "SFORFB0FZKZA06"


@pytest.mark.asyncio
@pytest.mark.parametrize("address", ["localhost", "127.0.0.1", "169.254.1.20", "::1"])
async def test_rejects_network_address_unreachable_by_ax_device(address):
    company = {**COMPANY, "ax_device_network_address": address}
    with pytest.raises(ValueError):
        await ArenaInfrastructureService(lambda: SettingsUnitOfWork()).update_operational_settings(
            60, 30, 5, True, None, company, NOW
        )
