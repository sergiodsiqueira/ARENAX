import json
from unittest.mock import patch

import pytest

from arenax.infrastructure.host_agent import HostAgentClient, HostAgentUnavailable


class Response:
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def read(self):
        return json.dumps({"path": "D:\\ARENAX\\Replays", "cancelled": False}).encode()


@pytest.mark.asyncio
async def test_calls_agent_with_shared_secret():
    client = HostAgentClient("http://agent:8765", "secret-value")
    with patch("arenax.infrastructure.host_agent.urlopen", return_value=Response()) as call:
        result = await client.select_folder()
    assert result["path"] == "D:\\ARENAX\\Replays"
    assert call.call_args.args[0].headers["Authorization"] == "Bearer secret-value"


@pytest.mark.asyncio
async def test_rejects_unconfigured_agent():
    with pytest.raises(HostAgentUnavailable, match="não está configurado"):
        await HostAgentClient("http://agent:8765", "").status()
