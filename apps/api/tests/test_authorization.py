from datetime import UTC, datetime
from uuid import uuid4

import pytest

from arenax.api.main import require_roles
from arenax.domain.errors import ForbiddenAccess
from arenax.domain.identity import User, UserRole, UserStatus

NOW = datetime(2026, 8, 19, 16, tzinfo=UTC)


def make_user(role):
    return User(
        id=uuid4(),
        name="Usuario",
        email="usuario@arena.com.br",
        password_hash="hash",
        role=role,
        status=UserStatus.ACTIVE,
        created_at=NOW,
        updated_at=NOW,
    )


@pytest.mark.asyncio
async def test_owner_and_administrator_can_use_administrative_dependency():
    authorize = require_roles(UserRole.OWNER, UserRole.ADMINISTRATOR)

    assert (await authorize(make_user(UserRole.OWNER))).role is UserRole.OWNER
    assert (await authorize(make_user(UserRole.ADMINISTRATOR))).role is UserRole.ADMINISTRATOR


@pytest.mark.asyncio
async def test_operator_cannot_use_administrative_dependency():
    authorize = require_roles(UserRole.OWNER, UserRole.ADMINISTRATOR)

    with pytest.raises(ForbiddenAccess):
        await authorize(make_user(UserRole.OPERATOR))
