from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from arenax.application.auth import AuthenticationService, PasswordRecoveryService
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


class PasswordRecoveryUnitOfWork:
    def __init__(self, user=None):
        self.user = user
        self.tokens = {}
        self.revoked_accesses = []
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get_user_by_email(self, email):
        return self.user if self.user and self.user.email == email else None

    async def add_password_reset_token(self, user_id, token_hash, now, expires_at):
        self.tokens[token_hash] = {
            "user_id": user_id,
            "created_at": now,
            "expires_at": expires_at,
            "used_at": None,
        }

    async def get_user_by_password_reset_token(self, token_hash, now, **_):
        token = self.tokens.get(token_hash)
        if not token or token["used_at"] is not None or token["expires_at"] <= now:
            return None
        return self.user if self.user and self.user.id == token["user_id"] else None

    async def update_user_password(self, user_id, password_hash, now):
        if self.user and self.user.id == user_id:
            self.user = replace(self.user, password_hash=password_hash, updated_at=now)

    async def mark_password_reset_token_used(self, token_hash, now):
        self.tokens[token_hash]["used_at"] = now

    async def revoke_password_reset_tokens(self, user_id, now):
        for token in self.tokens.values():
            if token["user_id"] == user_id and token["used_at"] is None:
                token["used_at"] = now

    async def revoke_user_accesses(self, user_id, now):
        self.revoked_accesses.append((user_id, now))

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


def make_password_recovery_service(uow):
    return PasswordRecoveryService(
        lambda: uow,
        FakePasswordHasher(),
        lambda: "reset-token-bruto",
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


@pytest.mark.asyncio
async def test_password_recovery_request_is_neutral_for_unknown_user():
    uow = PasswordRecoveryUnitOfWork()

    result = await make_password_recovery_service(uow).request_reset(
        "operador@arena.com.br",
        NOW,
        timedelta(minutes=30),
    )

    assert result.token is None
    assert result.expires_at is None
    assert uow.tokens == {}


@pytest.mark.asyncio
async def test_password_recovery_request_generates_reset_token_for_active_user():
    user = make_user()
    uow = PasswordRecoveryUnitOfWork(user)

    result = await make_password_recovery_service(uow).request_reset(
        " OPERADOR@ARENA.COM.BR ",
        NOW,
        timedelta(minutes=30),
    )

    assert result.token == "reset-token-bruto"
    assert result.expires_at == NOW + timedelta(minutes=30)
    assert uow.tokens["hash-token:reset-token-bruto"]["user_id"] == user.id
    assert uow.committed


@pytest.mark.asyncio
async def test_password_recovery_reset_updates_password_and_revokes_accesses():
    user = make_user()
    uow = PasswordRecoveryUnitOfWork(user)
    service = make_password_recovery_service(uow)
    await service.request_reset(user.email, NOW, timedelta(minutes=30))

    await service.reset_password("reset-token-bruto", "nova-senha-segura", NOW + timedelta(minutes=5))

    assert uow.user.password_hash == "hash:nova-senha-segura"
    assert uow.tokens["hash-token:reset-token-bruto"]["used_at"] == NOW + timedelta(minutes=5)
    assert uow.revoked_accesses == [(user.id, NOW + timedelta(minutes=5))]
    assert uow.committed


@pytest.mark.asyncio
async def test_password_recovery_reset_rejects_expired_or_used_token():
    user = make_user()
    uow = PasswordRecoveryUnitOfWork(user)
    service = make_password_recovery_service(uow)
    await service.request_reset(user.email, NOW, timedelta(minutes=30))

    with pytest.raises(InvalidCredentials, match="expirada"):
        await service.reset_password(
            "reset-token-bruto",
            "nova-senha-segura",
            NOW + timedelta(minutes=31),
        )
