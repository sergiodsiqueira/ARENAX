from datetime import UTC, date, datetime, timedelta

import pytest

from arenax.application.license import LicenseCheckUnavailable, LicenseService
from arenax.domain.license import LicenseState, decide_license

NOW = datetime(2026, 9, 2, 15, tzinfo=UTC)


def state(**changes):
    values = {
        "installation_started_at": NOW - timedelta(hours=1),
        "tax_id": "",
        "allowed": None,
        "valid_until": None,
        "customer_name": "",
        "next_check_at": None,
        "last_checked_at": None,
        "last_error": "",
    }
    values.update(changes)
    return LicenseState(**values)


def test_first_offline_initialization_has_two_day_grace():
    decision = decide_license(state(), "", NOW)
    assert decision.allowed
    assert decision.reason == "initial_offline_grace"
    assert decision.grace_until == NOW - timedelta(hours=1) + timedelta(days=2)
    assert decision.check_status == "not_consulted"


def test_unverified_installation_blocks_after_grace():
    decision = decide_license(
        state(installation_started_at=NOW - timedelta(days=2, seconds=1)), "", NOW
    )
    assert not decision.allowed
    assert decision.reason == "license_unverified"


def test_online_block_is_immediate_even_before_grace_ends():
    decision = decide_license(state(tax_id="123", allowed=False), "123", NOW)
    assert not decision.allowed
    assert decision.reason == "license_blocked"


def test_cached_license_uses_validity_while_offline():
    active = decide_license(
        state(tax_id="123", allowed=True, valid_until=NOW.date()), "123", NOW
    )
    expired = decide_license(
        state(tax_id="123", allowed=True, valid_until=NOW.date() - timedelta(days=1)),
        "123",
        NOW,
    )
    assert active.allowed
    assert not expired.allowed
    assert expired.reason == "license_expired"


class Repository:
    def __init__(self, current_state, tax_id):
        self.current_state = current_state
        self.tax_id = tax_id
        self.failure = None

    async def get_state_and_tax_id(self):
        return self.current_state, self.tax_id

    async def record_result(self, tax_id, result, now):
        self.current_state = state(
            tax_id=tax_id,
            allowed=result["allowed"],
            valid_until=result["valid_until"],
            customer_name=result["customer_name"],
            last_checked_at=now,
            next_check_at=now + timedelta(seconds=result["check_again_seconds"]),
        )
        return self.current_state

    async def record_failure(self, error, next_check_at):
        self.failure = (error, next_check_at)
        self.current_state = state(next_check_at=next_check_at, last_error=error)
        return self.current_state


class Gateway:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = 0

    async def check(self, _tax_id):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result


@pytest.mark.asyncio
async def test_online_result_is_cached_until_requested_interval():
    repository = Repository(state(), "123")
    gateway = Gateway({
        "allowed": True,
        "valid_until": date(2026, 12, 31),
        "customer_name": "Arena Cliente",
        "check_again_seconds": 3600,
    })
    decision = await LicenseService(repository, gateway).status(NOW)
    assert decision.allowed
    assert gateway.calls == 1
    assert repository.current_state.next_check_at == NOW + timedelta(hours=1)
    assert decision.check_status == "consulted"


@pytest.mark.asyncio
async def test_offline_failure_keeps_initial_grace_and_schedules_retry():
    repository = Repository(state(), "123")
    gateway = Gateway(error=LicenseCheckUnavailable())
    decision = await LicenseService(repository, gateway).status(NOW)
    assert decision.allowed
    assert repository.failure[1] == NOW + timedelta(minutes=5)
    assert decision.check_status == "unavailable"
