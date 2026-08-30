from uuid import uuid4

import pytest

from arenax.application.use_cases import ArenaInfrastructureService
from arenax.domain.errors import EntityNotFound, SpaceInUse


class SpaceUnitOfWork:
    def __init__(self, space=None, has_dependencies=False):
        self.space, self.has_dependencies = space, has_dependencies
        self.deleted = self.committed = False
    async def __aenter__(self): return self
    async def __aexit__(self, *_): return None
    async def get_space(self, space_id, **_): return self.space if self.space and self.space["id"] == space_id else None
    async def add_space(self, name, minute_rate_cents, status): self.space = {"id": uuid4(), "name": name, "administrative_status": status, "minute_rate_cents": minute_rate_cents}; return self.space["id"]
    async def update_space(self, space_id, name, status, minute_rate_cents): self.space = {"id": space_id, "name": name, "administrative_status": status, "minute_rate_cents": minute_rate_cents}; return self.space
    async def space_has_dependencies(self, _space_id): return self.has_dependencies
    async def delete_space(self, _space_id): self.deleted = True
    async def commit(self): self.committed = True


@pytest.mark.asyncio
async def test_updates_space_name_and_status():
    space = {"id": uuid4(), "name": "Quadra", "administrative_status": "active"}
    uow = SpaceUnitOfWork(space)
    result = await ArenaInfrastructureService(lambda: uow).update_space(space["id"], " Society 01 ", "maintenance", 250)
    assert result == {"id": space["id"], "name": "Society 01", "administrative_status": "maintenance", "minute_rate_cents": 250}
    assert uow.committed


@pytest.mark.asyncio
async def test_creates_inactive_space():
    uow = SpaceUnitOfWork()
    await ArenaInfrastructureService(lambda: uow).create_space("Quadra", 250, "disabled")
    assert uow.space["administrative_status"] == "disabled"
    assert uow.committed


@pytest.mark.asyncio
async def test_rejects_invalid_space_status():
    with pytest.raises(ValueError, match="inválido"):
        await ArenaInfrastructureService(lambda: SpaceUnitOfWork()).update_space(uuid4(), "Quadra", "occupied")


@pytest.mark.asyncio
async def test_cannot_delete_space_with_dependencies():
    space = {"id": uuid4(), "name": "Quadra", "administrative_status": "active"}
    uow = SpaceUnitOfWork(space, True)
    with pytest.raises(SpaceInUse):
        await ArenaInfrastructureService(lambda: uow).delete_space(space["id"])
    assert not uow.deleted


@pytest.mark.asyncio
async def test_deletes_unreferenced_space():
    space = {"id": uuid4(), "name": "Quadra", "administrative_status": "active"}
    uow = SpaceUnitOfWork(space)
    await ArenaInfrastructureService(lambda: uow).delete_space(space["id"])
    assert uow.deleted and uow.committed


@pytest.mark.asyncio
async def test_unknown_space_returns_not_found():
    with pytest.raises(EntityNotFound):
        await ArenaInfrastructureService(lambda: SpaceUnitOfWork()).delete_space(uuid4())
