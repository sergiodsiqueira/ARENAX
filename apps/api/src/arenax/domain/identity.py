from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class UserRole(StrEnum):
    OWNER = "proprietario"
    ADMINISTRATOR = "administrador"
    OPERATOR = "operador"


class UserStatus(StrEnum):
    ACTIVE = "ativo"
    BLOCKED = "bloqueado"
    DISABLED = "desativado"


@dataclass(frozen=True, slots=True)
class User:
    id: UUID
    name: str
    email: str
    password_hash: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime
    last_access_at: datetime | None = None
