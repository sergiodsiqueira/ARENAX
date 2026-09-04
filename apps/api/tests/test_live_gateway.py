from uuid import uuid4

import pytest

from arenax.infrastructure.live_gateway import MediaMtxGateway


@pytest.mark.asyncio
async def test_registers_rtsp_source_without_exposing_it_in_public_url():
    requests = []

    async def handler(method, url, payload):
        requests.append((method, url, payload))
        return 200

    gateway = MediaMtxGateway(
        "http://mediamtx:9997", "https://video.arenax.test", "secret",
        handler,
    )
    capture_url = "rtsp://user:password@camera.local/live"
    public_url = await gateway.ensure_camera(uuid4(), capture_url, "tcp")

    assert public_url.startswith("https://video.arenax.test/camera-")
    assert capture_url not in public_url
    assert requests[0][0] == "POST"
    assert requests[0][2]["source"] == capture_url


@pytest.mark.asyncio
async def test_updates_existing_mediamtx_path():
    methods = []

    async def handler(method, _url, _payload):
        methods.append(method)
        return 400 if method == "POST" else 200

    gateway = MediaMtxGateway(
        "http://mediamtx:9997", "http://localhost:8889", "secret",
        handler,
    )
    await gateway.ensure_camera(uuid4(), "rtsp://camera/live", "automatic")
    assert methods == ["POST", "PATCH"]


@pytest.mark.asyncio
async def test_removes_camera_path_from_gateway():
    methods = []

    async def handler(method, _url, _payload):
        methods.append(method)
        return 200

    gateway = MediaMtxGateway(
        "http://mediamtx:9997", "http://localhost:8889", "secret", handler
    )
    await gateway.remove_camera(uuid4())
    assert methods == ["DELETE"]
