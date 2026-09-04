from uuid import uuid4

import pytest

from arenax.application.use_cases import ArenaInfrastructureService


class QueryUnitOfWork:
    def __init__(self):
        self.clients = [{"id": uuid4(), "name": "Ana"}]
        self.spaces = [
            {"id": uuid4(), "name": "Society 01", "administrative_status": "active"}
        ]
        self.equipments = [
            {
                "id": uuid4(),
                "space_id": self.spaces[0]["id"],
                "kind": "camera",
                "external_id": "camera-01",
                "configuration": {},
            }
        ]
        self.equipment_filter = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def list_clients(self):
        return self.clients

    async def list_spaces(self):
        return self.spaces

    async def list_equipments(self, space_id=None):
        self.equipment_filter = space_id
        return self.equipments


@pytest.mark.asyncio
async def test_administrative_queries_are_read_through_projections():
    uow = QueryUnitOfWork()
    service = ArenaInfrastructureService(lambda: uow)

    assert await service.list_clients() == uow.clients
    assert await service.list_spaces() == uow.spaces
    assert await service.list_equipments(uow.spaces[0]["id"]) == uow.equipments
    assert uow.equipment_filter == uow.spaces[0]["id"]
