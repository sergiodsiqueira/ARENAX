import asyncio
import hashlib
import hmac
import json
from collections.abc import Awaitable, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID


class LiveGatewayUnavailable(Exception):
    """The internal live-video gateway could not configure a camera stream."""


class MediaMtxGateway:
    def __init__(
        self, api_url: str, public_webrtc_url: str, path_secret: str,
        requester: Callable[[str, str, dict], Awaitable[int]] | None = None,
    ):
        self._api_url = api_url.rstrip("/")
        self._public_webrtc_url = public_webrtc_url.rstrip("/")
        self._path_secret = path_secret.encode()
        self._requester = requester or self._request

    async def ensure_camera(self, camera_id: UUID, capture_url: str, transport: str) -> str:
        path = self._camera_path(camera_id)
        payload = {
            "source": capture_url,
            "sourceOnDemand": True,
            "sourceOnDemandCloseAfter": "10s",
            "rtspTransport": transport if transport in {"tcp", "udp", "multicast"} else "automatic",
        }
        try:
            status = await self._requester(
                "POST", f"{self._api_url}/v3/config/paths/add/{path}", payload
            )
            if status == 400:
                status = await self._requester(
                    "PATCH", f"{self._api_url}/v3/config/paths/patch/{path}", payload
                )
            if status >= 400:
                raise LiveGatewayUnavailable(f"Live gateway rejected configuration ({status})")
        except (OSError, URLError, TimeoutError) as exc:
            raise LiveGatewayUnavailable("Live video gateway is unavailable") from exc
        return f"{self._public_webrtc_url}/{path}?controls=true&muted=true&autoplay=true&playsInline=true"

    async def remove_camera(self, camera_id: UUID) -> None:
        try:
            status = await self._requester(
                "DELETE",
                f"{self._api_url}/v3/config/paths/delete/{self._camera_path(camera_id)}",
                {},
            )
            if status not in {200, 404}:
                raise LiveGatewayUnavailable(f"Live gateway rejected removal ({status})")
        except (OSError, URLError, TimeoutError) as exc:
            raise LiveGatewayUnavailable("Live video gateway is unavailable") from exc

    def _camera_path(self, camera_id: UUID) -> str:
        digest = hmac.new(self._path_secret, str(camera_id).encode(), hashlib.sha256).hexdigest()[:24]
        return f"camera-{digest}"

    @staticmethod
    async def _request(method: str, url: str, payload: dict) -> int:
        def send() -> int:
            request = Request(
                url,
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
                method=method,
            )
            try:
                with urlopen(request, timeout=5) as response:  # noqa: S310 - internal configured URL
                    return response.status
            except HTTPError as exc:
                return exc.code

        return await asyncio.to_thread(send)
