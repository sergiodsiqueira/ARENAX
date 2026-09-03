import pytest
from httpx import ASGITransport, AsyncClient

from arenax.api.main import app


async def preflight(origin: str):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://api") as client:
        return await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )


@pytest.mark.asyncio
async def test_allows_frontend_on_private_local_network():
    response = await preflight("http://172.23.48.1:5174")
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://172.23.48.1:5174"
    assert response.headers["access-control-allow-credentials"] == "true"


@pytest.mark.asyncio
async def test_does_not_allow_arbitrary_public_origin():
    response = await preflight("https://example.com")
    assert "access-control-allow-origin" not in response.headers
