from uuid import uuid4

import pytest

from arenax.application.use_cases import ArenaInfrastructureService
from arenax.domain.errors import EntityNotFound


class EquipmentUnitOfWork:
    def __init__(self, equipment=None, space=None):
        self.equipment = equipment
        self.space = space
        self.deleted = self.committed = False

    async def __aenter__(self): return self
    async def __aexit__(self, *_): return None
    async def get_equipment(self, equipment_id, **_):
        return self.equipment if self.equipment and self.equipment["id"] == equipment_id else None
    async def get_space(self, space_id, **_):
        return self.space if self.space and self.space["id"] == space_id else None
    async def update_equipment(self, equipment_id, space_id, kind, external_id, description, configuration, status):
        self.equipment = {
            "id": equipment_id, "space_id": space_id, "kind": kind,
            "external_id": external_id, "description": description,
            "configuration": configuration,
            "administrative_status": status,
        }
        return self.equipment
    async def delete_equipment(self, _equipment_id): self.deleted = True
    async def commit(self): self.committed = True


@pytest.mark.asyncio
async def test_updates_equipment_and_can_move_it_to_another_space():
    equipment = {"id": uuid4(), "kind": "ax_device"}
    space = {"id": uuid4(), "name": "Society"}
    uow = EquipmentUnitOfWork(equipment, space)
    result = await ArenaInfrastructureService(lambda: uow).update_equipment(
        equipment["id"], space["id"], "camera", " camera-01 ", " Câmera principal ",
        {"capture_url": "rtsp://camera/live"},
    )
    assert result["external_id"] == "camera-01"
    assert result["description"] == "Câmera principal"
    assert result["space_id"] == space["id"]
    assert uow.committed


@pytest.mark.asyncio
async def test_camera_requires_capture_url():
    with pytest.raises(ValueError, match="URL de captura"):
        await ArenaInfrastructureService(lambda: EquipmentUnitOfWork()).update_equipment(
            uuid4(), uuid4(), "camera", "camera-01", "Principal", {}
        )


@pytest.mark.asyncio
async def test_deletes_equipment_even_after_operational_use():
    equipment = {"id": uuid4(), "kind": "ax_device"}
    uow = EquipmentUnitOfWork(equipment=equipment)
    await ArenaInfrastructureService(lambda: uow).delete_equipment(equipment["id"])
    assert uow.deleted and uow.committed


@pytest.mark.asyncio
async def test_deletes_equipment_without_history():
    equipment = {"id": uuid4(), "kind": "camera"}
    uow = EquipmentUnitOfWork(equipment=equipment)
    await ArenaInfrastructureService(lambda: uow).delete_equipment(equipment["id"])
    assert uow.deleted and uow.committed


@pytest.mark.asyncio
async def test_unknown_equipment_returns_not_found():
    with pytest.raises(EntityNotFound):
        await ArenaInfrastructureService(lambda: EquipmentUnitOfWork()).delete_equipment(uuid4())
