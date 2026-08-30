import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


class PostalCodeLookupError(RuntimeError):
    pass


class OpenCepClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def lookup(self, postal_code: str) -> dict:
        digits = "".join(character for character in postal_code if character.isdigit())
        if len(digits) != 8:
            raise ValueError("O CEP deve ter 8 dígitos")
        return await asyncio.to_thread(self._lookup, digits)

    def _lookup(self, postal_code: str) -> dict:
        try:
            with urlopen(f"{self.base_url}/{postal_code}", timeout=5) as response:
                payload = json.loads(response.read().decode())
        except HTTPError as exc:
            if exc.code == 404:
                raise PostalCodeLookupError("CEP não encontrado") from exc
            raise PostalCodeLookupError("O serviço de CEP não respondeu à consulta") from exc
        except (URLError, TimeoutError, OSError, ValueError) as exc:
            raise PostalCodeLookupError("O serviço de CEP está temporariamente indisponível") from exc
        if not payload.get("cep"):
            raise PostalCodeLookupError("CEP não encontrado")
        return {
            "postal_code": "".join(character for character in payload["cep"] if character.isdigit()),
            "street": payload.get("logradouro", ""),
            "neighborhood": payload.get("bairro", ""),
            "city": payload.get("localidade", ""),
            "state": payload.get("uf", ""),
        }
