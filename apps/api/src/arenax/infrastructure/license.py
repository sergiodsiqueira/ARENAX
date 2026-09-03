import asyncio
import json
from datetime import date, datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from sqlalchemy import select

from arenax.application.license import LicenseCheckUnavailable
from arenax.domain.license import LicenseState

from .database import session_factory
from .models import LicenseStateModel, OperationalSettingsModel


class LicenseGateway:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def check(self, tax_id: str) -> dict:
        return await asyncio.to_thread(self._check, tax_id)

    def _check(self, tax_id: str) -> dict:
        request = Request(
            f"{self.base_url}/{quote(tax_id, safe='')}",
            headers={"Accept": "application/json"},
        )
        try:
            with urlopen(request, timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            raise LicenseCheckUnavailable("Serviço de licenças indisponível") from exc

        allowed = payload.get("liberado")
        valid_until_raw = payload.get("validade")
        check_again = payload.get("verificarNovamente")
        if not isinstance(allowed, bool) or not isinstance(check_again, int) or check_again <= 0:
            raise LicenseCheckUnavailable("Resposta inválida do serviço de licenças")
        valid_until = None
        if valid_until_raw not in (None, ""):
            try:
                valid_until = date.fromisoformat(str(valid_until_raw)[:10])
            except (TypeError, ValueError) as exc:
                raise LicenseCheckUnavailable("Validade inválida no serviço de licenças") from exc
        if allowed and valid_until is None:
            raise LicenseCheckUnavailable("Licença liberada sem data de validade")
        return {
            "allowed": allowed,
            "valid_until": valid_until,
            "customer_name": str(payload.get("cliente") or "").strip(),
            "check_again_seconds": check_again,
        }


class SqlAlchemyLicenseRepository:
    async def get_state_and_tax_id(self) -> tuple[LicenseState, str]:
        async with session_factory() as session:
            state = await session.get(LicenseStateModel, 1)
            settings = await session.get(OperationalSettingsModel, 1)
            if state is None or settings is None:
                raise RuntimeError("Estado da licença não foi inicializado")
            return self._to_domain(state), settings.company_tax_id

    async def record_result(self, tax_id: str, result: dict, now: datetime) -> LicenseState:
        async with session_factory.begin() as session:
            model = await session.scalar(
                select(LicenseStateModel).where(LicenseStateModel.id == 1).with_for_update()
            )
            model.tax_id = tax_id
            model.allowed = result["allowed"]
            model.valid_until = result["valid_until"]
            model.customer_name = result["customer_name"]
            model.last_checked_at = now
            model.next_check_at = now + timedelta(seconds=result["check_again_seconds"])
            model.last_error = ""
            await session.flush()
            return self._to_domain(model)

    async def record_failure(self, error: str, next_check_at: datetime) -> LicenseState:
        async with session_factory.begin() as session:
            model = await session.scalar(
                select(LicenseStateModel).where(LicenseStateModel.id == 1).with_for_update()
            )
            model.last_error = error[:500]
            model.next_check_at = next_check_at
            await session.flush()
            return self._to_domain(model)

    @staticmethod
    def _to_domain(model: LicenseStateModel) -> LicenseState:
        return LicenseState(
            installation_started_at=model.installation_started_at,
            tax_id=model.tax_id,
            allowed=model.allowed,
            valid_until=model.valid_until,
            customer_name=model.customer_name,
            next_check_at=model.next_check_at,
            last_checked_at=model.last_checked_at,
            last_error=model.last_error,
        )
