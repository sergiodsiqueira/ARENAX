from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass(frozen=True, slots=True)
class LicenseState:
    installation_started_at: datetime
    tax_id: str
    allowed: bool | None
    valid_until: date | None
    customer_name: str
    next_check_at: datetime | None
    last_checked_at: datetime | None
    last_error: str


@dataclass(frozen=True, slots=True)
class LicenseDecision:
    allowed: bool
    reason: str
    customer_name: str
    valid_until: date | None
    grace_until: datetime
    next_check_at: datetime | None
    check_status: str


def decide_license(state: LicenseState, current_tax_id: str, now: datetime) -> LicenseDecision:
    grace_until = state.installation_started_at + timedelta(days=2)
    same_customer = bool(current_tax_id) and state.tax_id == current_tax_id
    check_status = (
        "unavailable" if state.last_error
        else "consulted" if state.last_checked_at is not None
        else "not_consulted"
    )

    if same_customer and state.allowed is False:
        return LicenseDecision(
            False, "license_blocked", state.customer_name, state.valid_until,
            grace_until, state.next_check_at, check_status,
        )
    if same_customer and state.allowed is True:
        valid = state.valid_until is not None and now.date() <= state.valid_until
        return LicenseDecision(
            valid,
            "license_active" if valid else "license_expired",
            state.customer_name,
            state.valid_until,
            grace_until,
            state.next_check_at,
            check_status,
        )
    if now < grace_until:
        return LicenseDecision(
            True, "initial_offline_grace", "", None, grace_until, state.next_check_at,
            check_status,
        )
    return LicenseDecision(
        False, "license_unverified", "", None, grace_until, state.next_check_at,
        check_status,
    )
