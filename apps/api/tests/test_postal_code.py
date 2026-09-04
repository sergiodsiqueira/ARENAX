import json
from unittest.mock import patch

import pytest

from arenax.infrastructure.postal_code import OpenCepClient


class Response:
    def __enter__(self): return self
    def __exit__(self, *_): return None
    def read(self):
        return json.dumps({
            "cep": "01001-000", "logradouro": "Praça da Sé", "bairro": "Sé",
            "localidade": "São Paulo", "uf": "SP",
        }).encode()


@pytest.mark.asyncio
async def test_maps_open_cep_response():
    with patch("arenax.infrastructure.postal_code.urlopen", return_value=Response()) as call:
        result = await OpenCepClient("https://opencep.com/v1").lookup("01001-000")
    assert result == {
        "postal_code": "01001000", "street": "Praça da Sé", "neighborhood": "Sé",
        "city": "São Paulo", "state": "SP",
    }
    assert call.call_args.args[0] == "https://opencep.com/v1/01001000"


@pytest.mark.asyncio
async def test_rejects_invalid_postal_code_without_external_call():
    with pytest.raises(ValueError, match="8 dígitos"):
        await OpenCepClient("https://opencep.com/v1").lookup("123")
