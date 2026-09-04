import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class HostAgentUnavailable(RuntimeError):
    pass


class HostAgentClient:
    def __init__(self, base_url: str, secret: str):
        self.base_url = base_url.rstrip("/")
        self.secret = secret

    async def status(self) -> dict:
        return await asyncio.to_thread(self._request, "GET", "/status", None, 5)

    async def select_folder(self) -> dict:
        return await asyncio.to_thread(self._request, "POST", "/select-folder", {}, 300)

    async def network_interfaces(self) -> list[dict]:
        result = await asyncio.to_thread(self._request, "GET", "/network-interfaces", None, 5)
        return list(result.get("interfaces", []))

    async def apply_storage(self, path: str) -> dict:
        return await asyncio.to_thread(
            self._request, "POST", "/apply-storage", {"path": path}, 10
        )

    def _request(self, method: str, path: str, payload: dict | None, timeout: int) -> dict:
        if not self.secret:
            raise HostAgentUnavailable("O Agente Local da ARENAX não está configurado.")
        data = json.dumps(payload).encode() if payload is not None else None
        request = Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.secret}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode())
        except HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode()).get("message")
            except (ValueError, AttributeError):
                detail = None
            raise HostAgentUnavailable(detail or "O Agente Local recusou a operação.") from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise HostAgentUnavailable(
                "O Agente Local não está disponível na máquina da ARENAX."
            ) from exc
