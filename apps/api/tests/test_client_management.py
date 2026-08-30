from uuid import uuid4

import pytest

from arenax.application.use_cases import ArenaInfrastructureService
from arenax.domain.errors import ClientInUse, EntityNotFound


class ClientUnitOfWork:
    def __init__(self, client=None, has_sessions=False):
        self.client = client
        self.has_sessions = has_sessions
        self.committed = False
        self.deleted = False

    async def __aenter__(self): return self
    async def __aexit__(self, *_): return None
    async def get_client(self, client_id, **_): return self.client if self.client and self.client["id"] == client_id else None
    async def add_client(self, name, client_type, document, postal_code, address, city, state, notes, phone, email, whatsapp, status):
        self.client = {"id": uuid4(), "name": name, "client_type": client_type, "document": document, "postal_code": postal_code, "address": address, "city": city, "state": state, "notes": notes, "phone": phone, "email": email, "whatsapp": whatsapp, "administrative_status": status}
        return self.client["id"]
    async def update_client(self, client_id, name, client_type, document, postal_code, address, city, state, notes, phone, email, whatsapp, status): self.client = {"id": client_id, "name": name, "client_type": client_type, "document": document, "postal_code": postal_code, "address": address, "city": city, "state": state, "notes": notes, "phone": phone, "email": email, "whatsapp": whatsapp, "administrative_status": status}; return self.client
    async def client_has_sessions(self, _client_id): return self.has_sessions
    async def delete_client(self, _client_id): self.deleted = True
    async def commit(self): self.committed = True


@pytest.mark.asyncio
async def test_updates_client_name():
    client = {"id": uuid4(), "name": "Nome anterior"}
    uow = ClientUnitOfWork(client)
    result = await ArenaInfrastructureService(lambda: uow).update_client(
        client["id"], "  Novo nome  ", "F", "123.456.789-01"
    )
    assert result["name"] == "Novo nome"
    assert uow.committed


@pytest.mark.asyncio
async def test_cannot_delete_client_responsible_for_session():
    client = {"id": uuid4(), "name": "Cliente"}
    uow = ClientUnitOfWork(client, has_sessions=True)
    with pytest.raises(ClientInUse):
        await ArenaInfrastructureService(lambda: uow).delete_client(client["id"])
    assert not uow.deleted


@pytest.mark.asyncio
async def test_deletes_unreferenced_client():
    client = {"id": uuid4(), "name": "Cliente"}
    uow = ClientUnitOfWork(client)
    await ArenaInfrastructureService(lambda: uow).delete_client(client["id"])
    assert uow.deleted and uow.committed


@pytest.mark.asyncio
async def test_update_unknown_client_returns_not_found():
    with pytest.raises(EntityNotFound):
        await ArenaInfrastructureService(lambda: ClientUnitOfWork()).update_client(
            uuid4(), "Cliente", "F", "12345678901"
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "client_type,document,normalized",
    [("F", "123.456.789-01", "12345678901"), ("J", "SF.ORF.B0F/ZKZA-06", "SFORFB0FZKZA06")],
)
async def test_creates_client_with_normalized_document(client_type, document, normalized):
    uow = ClientUnitOfWork()
    await ArenaInfrastructureService(lambda: uow).create_client(
        "Cliente", client_type, document
    )
    assert uow.client["document"] == normalized
    assert uow.client["client_type"] == client_type
    assert uow.committed


@pytest.mark.asyncio
async def test_allows_client_without_document():
    uow = ClientUnitOfWork()
    await ArenaInfrastructureService(lambda: uow).create_client("Cliente", "F", "")
    assert uow.client["document"] == ""


@pytest.mark.asyncio
@pytest.mark.parametrize("client_type,document", [("F", "123"), ("J", "1234567800019A"), ("X", "12345678901")])
async def test_rejects_invalid_client_document(client_type, document):
    with pytest.raises(ValueError):
        await ArenaInfrastructureService(lambda: ClientUnitOfWork()).create_client(
            "Cliente", client_type, document
        )


@pytest.mark.asyncio
async def test_normalizes_client_address():
    uow = ClientUnitOfWork()
    await ArenaInfrastructureService(lambda: uow).create_client(
        "Cliente", "F", "12345678901", "01001-000",
        " Praça da Sé, 10 ", " São Paulo ", "sp",
    )
    assert uow.client["postal_code"] == "01001000"
    assert uow.client["address"] == "Praça da Sé, 10"
    assert uow.client["city"] == "São Paulo"
    assert uow.client["state"] == "SP"


@pytest.mark.asyncio
async def test_stores_long_client_notes_and_selected_status():
    notes = "Observação operacional. " * 30
    uow = ClientUnitOfWork()
    await ArenaInfrastructureService(lambda: uow).create_client(
        "Cliente", "F", "12345678901", notes=notes,
        administrative_status="inactive",
    )
    assert len(uow.client["notes"]) > 500
    assert uow.client["notes"] == notes.strip()
    assert uow.client["administrative_status"] == "inactive"


@pytest.mark.asyncio
async def test_normalizes_client_contact_and_stores_whatsapp_flag():
    uow = ClientUnitOfWork()
    await ArenaInfrastructureService(lambda: uow).create_client(
        "Cliente", "F", "", phone="(11) 99999-0000",
        email=" CLIENTE@EXEMPLO.COM ", whatsapp=True,
    )
    assert uow.client["phone"] == "11999990000"
    assert uow.client["email"] == "cliente@exemplo.com"
    assert uow.client["whatsapp"] is True
