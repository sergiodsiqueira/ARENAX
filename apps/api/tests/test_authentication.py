from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from arenax.application.auth import AuthenticationService
from arenax.domain.errors import InvalidAccess, InvalidCredentials
from arenax.domain.identity import User, UserRole, UserStatus

NOW = datetime(2026, 8, 19, 15, tzinfo=UTC)


class FakePasswordHasher:
    def hash(self, password):
        return f"hash:{password}"

    def verify(self, password, password_hash):
        return password_hash == f"hash:{password}"


class AuthUnitOfWork:
    def __init__(self, user=None):
        self.user = user
        self.accesses = {}
        self.revoked = None
        self.last_access = None
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get_user_by_email(self, email):
        return self.user if self.user and self.user.email == email else None

    async def add_access(self, user_id, token_hash, now, expires_at, persistent):
        self.accesses[token_hash] = (user_id, now, expires_at, persistent)

    async def register_last_access(self, user_id, now):
        self.last_access = (user_id, now)

    async def get_user_by_access(self, token_hash, now):
        access = self.accesses.get(token_hash)
        if not access or access[2] <= now or self.revoked == token_hash:
            return None
        return self.user

    async def revoke_access(self, token_hash, now):
        self.revoked = token_hash

    async def commit(self):
        self.committed = True


def make_user(status=UserStatus.ACTIVE):
    return User(
        id=uuid4(),
        name="Operador",
        email="operador@arena.com.br",
        password_hash="hash:senha-segura",
        role=UserRole.OPERATOR,
        status=status,
        created_at=NOW,
        updated_at=NOW,
    )


def make_service(uow):
    return AuthenticationService(
        lambda: uow,
        FakePasswordHasher(),
        lambda: "token-bruto",
        lambda token: f"hash-token:{token}",
    )


@pytest.mark.asyncio
async def test_login_creates_persistent_access_and_registers_last_access():
    user = make_user()
    uow = AuthUnitOfWork(user)

    result = await make_service(uow).login(
        " OPERADOR@ARENA.COM.BR ",
        "senha-segura",
        True,
        NOW,
        timedelta(hours=12),
        timedelta(days=30),
    )

    assert result.user == user
    assert result.token == "token-bruto"
    assert result.expires_at == NOW + timedelta(days=30)
    assert uow.accesses["hash-token:token-bruto"][3] is True
    assert uow.last_access == (user.id, NOW)
    assert uow.committed


@pytest.mark.asyncio
@pytest.mark.parametrize("user", [None, make_user(UserStatus.BLOCKED)])
async def test_login_returns_same_error_for_unknown_or_inactive_user(user):
    with pytest.raises(InvalidCredentials, match="E-mail ou senha inválidos"):
        await make_service(AuthUnitOfWork(user)).login(
            "operador@arena.com.br",
            "senha-segura",
            False,
            NOW,
            timedelta(hours=12),
            timedelta(days=30),
        )


@pytest.mark.asyncio
async def test_current_user_rejects_revoked_access():
    user = make_user()
    uow = AuthUnitOfWork(user)
    service = make_service(uow)
    await service.login(
        user.email,
        "senha-segura",
        False,
        NOW,
        timedelta(hours=12),
        timedelta(days=30),
    )
    await service.logout("token-bruto", NOW + timedelta(minutes=1))

    with pytest.raises(InvalidAccess):
        await service.current_user("token-bruto", NOW + timedelta(minutes=2))
