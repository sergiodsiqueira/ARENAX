from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from arenax.application.auth import UserAdministrationService
from arenax.domain.errors import ForbiddenAccess
from arenax.domain.identity import User, UserRole, UserStatus

NOW = datetime(2026, 8, 20, 12, tzinfo=UTC)


class FakeHasher:
    def hash(self, password): return f"hash:{password}"


def make_user(role=UserRole.OPERATOR, status=UserStatus.ACTIVE):
    return User(uuid4(), role.value, f"{uuid4()}@arena.test", "hash", role, status, NOW, NOW)


class UserUow:
    def __init__(self, users):
        self.users = {user.id: user for user in users}
        self.revoked = []
        self.committed = False

    async def __aenter__(self): return self
    async def __aexit__(self, *_): return None
    async def list_users(self): return list(self.users.values())
    async def get_user(self, user_id, **_): return self.users.get(user_id)
    async def get_user_by_email(self, email): return next((u for u in self.users.values() if u.email == email), None)
    async def add_user(self, name, email, password_hash, role, now):
        user = User(uuid4(), name, email, password_hash, role, UserStatus.ACTIVE, now, now)
        self.users[user.id] = user
        return user
    async def update_user(self, user_id, role, status, now):
        self.users[user_id] = replace(self.users[user_id], role=role, status=status, updated_at=now)
        return self.users[user_id]
    async def update_user_password(self, user_id, password_hash, now):
        self.users[user_id] = replace(self.users[user_id], password_hash=password_hash, updated_at=now)
    async def revoke_user_accesses(self, user_id, _now): self.revoked.append(user_id)
    async def count_active_owners(self):
        return sum(u.role is UserRole.OWNER and u.status is UserStatus.ACTIVE for u in self.users.values())
    async def commit(self): self.committed = True


def service(uow): return UserAdministrationService(lambda: uow, FakeHasher())


@pytest.mark.asyncio
async def test_administrator_cannot_create_or_see_owner():
    administrator, owner = make_user(UserRole.ADMINISTRATOR), make_user(UserRole.OWNER)
    uow = UserUow([administrator, owner])
    assert await service(uow).list_users(administrator) == [administrator]
    with pytest.raises(ForbiddenAccess):
        await service(uow).create_user("Novo", "novo@arena.test", "senha-com-12", UserRole.OWNER, NOW, administrator)


@pytest.mark.asyncio
async def test_user_cannot_deactivate_self():
    owner = make_user(UserRole.OWNER)
    with pytest.raises(ForbiddenAccess):
        await service(UserUow([owner])).update_user(owner, owner.id, owner.role, UserStatus.DISABLED, NOW)


@pytest.mark.asyncio
async def test_last_active_owner_is_preserved():
    owner = make_user(UserRole.OWNER)
    with pytest.raises(ValueError, match="Proprietário ativo"):
        await service(UserUow([owner])).update_user(owner, owner.id, UserRole.ADMINISTRATOR, UserStatus.ACTIVE, NOW)


@pytest.mark.asyncio
async def test_blocking_user_revokes_active_accesses():
    owner, operator = make_user(UserRole.OWNER), make_user()
    uow = UserUow([owner, operator])
    updated = await service(uow).update_user(owner, operator.id, operator.role, UserStatus.BLOCKED, NOW)
    assert updated.status is UserStatus.BLOCKED
    assert uow.revoked == [operator.id]
    assert uow.committed


@pytest.mark.asyncio
async def test_reset_password_hashes_and_revokes_accesses():
    owner, operator = make_user(UserRole.OWNER), make_user()
    uow = UserUow([owner, operator])
    await service(uow).reset_password(owner, operator.id, "nova-senha-segura", NOW)
    assert uow.users[operator.id].password_hash == "hash:nova-senha-segura"
    assert uow.revoked == [operator.id]
