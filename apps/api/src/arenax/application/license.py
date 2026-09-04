from datetime import datetime, timedelta

from arenax.domain.license import LicenseDecision, decide_license


class LicenseCheckUnavailable(RuntimeError):
    pass


class LicenseService:
    def __init__(self, repository, gateway):
        self._repository = repository
        self._gateway = gateway

    async def status(self, now: datetime) -> LicenseDecision:
        state, tax_id = await self._repository.get_state_and_tax_id()
        should_check = bool(tax_id) and (
            state.tax_id != tax_id
            or state.next_check_at is None
            or state.next_check_at <= now
        )
        if should_check:
            try:
                result = await self._gateway.check(tax_id)
            except LicenseCheckUnavailable as exc:
                state = await self._repository.record_failure(
                    str(exc) or "Serviço de licenças indisponível",
                    now + timedelta(minutes=5),
                )
            else:
                state = await self._repository.record_result(tax_id, result, now)
        return decide_license(state, tax_id, now)
