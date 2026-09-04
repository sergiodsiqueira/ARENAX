from datetime import UTC, datetime
from uuid import uuid4

import pytest

from arenax.application.use_cases import PaymentService
from arenax.domain.errors import EntityNotFound
from arenax.domain.payment import calculate_expected_amount_cents, calculate_session_amount_cents

NOW = datetime(2026, 8, 27, 18, tzinfo=UTC)


class PaymentUnitOfWork:
    def __init__(self, session_exists=True):
        self.session_exists = session_exists
        self.payment = None
        self.timeline = None
        self.committed = False
        self.expected_amount = 6000
        self.override = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get_session(self, _session_id, *, lock=False):
        assert lock
        return object() if self.session_exists else None

    async def add_payment(self, payment):
        self.payment = payment

    async def add_timeline(self, *entry):
        self.timeline = entry

    async def commit(self):
        self.committed = True

    async def session_expected_amount(self, _session_id, _now):
        return self.expected_amount

    async def set_expected_amount_override(self, _session_id, amount_cents):
        self.override = amount_cents

    async def recalculate_session_expected_amount(self, _session_id, _now):
        self.override = None
        return 7200


@pytest.mark.asyncio
async def test_registers_manual_payment_and_timeline_atomically():
    uow = PaymentUnitOfWork()
    session_id, user_id = uuid4(), uuid4()

    result = await PaymentService(lambda: uow).register(
        session_id, 12_350, "pix", "  sinal  ", user_id, NOW
    )

    assert result.amount_cents == 12_350
    assert result.note == "sinal"
    assert result.registered_by == user_id
    assert uow.payment == result
    assert uow.timeline[:3] == (session_id, "PaymentRegistered", NOW)
    assert uow.timeline[3]["paymentId"] == str(result.id)
    assert uow.committed


@pytest.mark.asyncio
@pytest.mark.parametrize("amount", [0, -1])
async def test_rejects_non_positive_amount(amount):
    uow = PaymentUnitOfWork()
    with pytest.raises(ValueError, match="positive"):
        await PaymentService(lambda: uow).register(
            uuid4(), amount, "cash", None, uuid4(), NOW
        )
    assert not uow.committed


@pytest.mark.asyncio
async def test_rejects_unknown_method_and_missing_session():
    with pytest.raises(ValueError, match="method"):
        await PaymentService(lambda: PaymentUnitOfWork()).register(
            uuid4(), 100, "bank_slip", None, uuid4(), NOW
        )

    uow = PaymentUnitOfWork(session_exists=False)
    with pytest.raises(EntityNotFound):
        await PaymentService(lambda: uow).register(
            uuid4(), 100, "cash", None, uuid4(), NOW
        )
    assert not uow.committed


def test_expected_amount_uses_all_space_rates_and_rounds_partial_minute_up():
    result = calculate_expected_amount_cents(
        NOW, NOW.replace(hour=19, second=1), [200, 350]
    )
    assert result == 61 * 550


def test_session_amount_uses_actual_or_scheduled_period_according_to_setting():
    scheduled_end = NOW.replace(hour=20)
    actual_start = NOW.replace(hour=18, minute=10)
    actual_end = NOW.replace(hour=18, minute=50)

    assert calculate_session_amount_cents(
        NOW, scheduled_end, actual_start, actual_end, scheduled_end, [100], True
    ) == 4000
    assert calculate_session_amount_cents(
        NOW, scheduled_end, actual_start, actual_end, scheduled_end, [100], False
    ) == 12_000
    assert calculate_session_amount_cents(
        NOW, scheduled_end, None, None, NOW, [100], True
    ) == 0


@pytest.mark.asyncio
async def test_changes_expected_amount_and_audits_previous_value():
    uow = PaymentUnitOfWork()
    session_id, user_id = uuid4(), uuid4()

    result = await PaymentService(lambda: uow).change_expected_amount(
        session_id, 7500, user_id, NOW
    )

    assert result == 7500
    assert uow.override == 7500
    assert uow.timeline[1] == "ExpectedAmountChanged"
    assert uow.timeline[3]["previousAmountCents"] == 6000
    assert uow.committed


@pytest.mark.asyncio
async def test_recalculates_expected_amount_from_current_space_rates():
    uow = PaymentUnitOfWork()

    result = await PaymentService(lambda: uow).recalculate_expected_amount(
        uuid4(), uuid4(), NOW
    )

    assert result == 7200
    assert uow.timeline[1] == "ExpectedAmountRecalculated"
    assert uow.committed
