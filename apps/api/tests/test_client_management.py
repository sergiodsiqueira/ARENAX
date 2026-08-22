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
    async def update_client(self, client_id, name, status): self.client = {"id": client_id, "name": name, "administrative_status": status}; return self.client
    async def client_has_sessions(self, _client_id): return self.has_sessions
    async def delete_client(self, _client_id): self.deleted = True
    async def commit(self): self.committed = True


@pytest.mark.asyncio
async def test_updates_client_name():
    client = {"id": uuid4(), "name": "Nome anterior"}
    uow = ClientUnitOfWork(client)
    result = await ArenaInfrastructureService(lambda: uow).update_client(client["id"], "  Novo nome  ")
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
        await ArenaInfrastructureService(lambda: ClientUnitOfWork()).update_client(uuid4(), "Cliente")
