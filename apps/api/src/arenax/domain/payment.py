from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from math import ceil
from uuid import UUID, uuid4


class PaymentMethod(StrEnum):
    CASH = "cash"
    PIX = "pix"
    DEBIT_CARD = "debit_card"
    CREDIT_CARD = "credit_card"
    OTHER = "other"


@dataclass(frozen=True, slots=True)
class Payment:
    session_id: UUID
    amount_cents: int
    method: PaymentMethod
    registered_at: datetime
    registered_by: UUID
    note: str | None = None
    id: UUID = field(default_factory=uuid4)

    def __post_init__(self) -> None:
        if isinstance(self.amount_cents, bool) or self.amount_cents <= 0:
            raise ValueError("Payment amount must be positive")
        if self.registered_at.tzinfo is None or self.registered_at.utcoffset() is None:
            raise ValueError("Payment registration time must include a timezone")
        normalized_note = self.note.strip() if self.note else None
        if normalized_note and len(normalized_note) > 500:
            raise ValueError("Payment note must contain at most 500 characters")
        object.__setattr__(self, "note", normalized_note or None)


def calculate_expected_amount_cents(
    scheduled_start: datetime,
    scheduled_end: datetime,
    minute_rates_cents: list[int],
) -> int:
    if scheduled_end <= scheduled_start:
        raise ValueError("Payment calculation period must be positive")
    if any(rate < 0 for rate in minute_rates_cents):
        raise ValueError("Space minute rate cannot be negative")
    minutes = ceil((scheduled_end - scheduled_start).total_seconds() / 60)
    return minutes * sum(minute_rates_cents)


def calculate_session_amount_cents(
    scheduled_start: datetime,
    scheduled_end: datetime,
    actual_start: datetime | None,
    actual_end: datetime | None,
    now: datetime,
    minute_rates_cents: list[int],
    calculate_actual_time: bool,
) -> int:
    if not calculate_actual_time:
        return calculate_expected_amount_cents(
            scheduled_start, scheduled_end, minute_rates_cents
        )
    if actual_start is None:
        return 0
    calculation_end = actual_end or now
    if calculation_end <= actual_start:
        return 0
    return calculate_expected_amount_cents(
        actual_start, calculation_end, minute_rates_cents
    )
