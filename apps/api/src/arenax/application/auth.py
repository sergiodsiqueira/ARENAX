from dataclasses import dataclass
from datetime import datetime, timedelta

from arenax.domain.errors import InvalidAccess, InvalidCredentials
from arenax.domain.identity import User, UserRole, UserStatus


@dataclass(frozen=True, slots=True)
class LoginResult:
    user: User
    token: str
    expires_at: datetime
    persistent: bool


class AuthenticationService:
    def __init__(self, uow_factory, password_hasher, token_issuer, token_hasher):
        self._uow_factory = uow_factory
        self._password_hasher = password_hasher
        self._token_issuer = token_issuer
        self._token_hasher = token_hasher
        self._dummy_password_hash = password_hasher.hash("arenax-invalid-credential")

    async def login(
        self,
        email: str,
        password: str,
        remember: bool,
        now: datetime,
        regular_duration: timedelta,
        persistent_duration: timedelta,
    ) -> LoginResult:
        normalized_email = email.strip().casefold()
        async with self._uow_factory() as uow:
            user = await uow.get_user_by_email(normalized_email)
            password_hash = user.password_hash if user else self._dummy_password_hash
            password_valid = self._password_hasher.verify(password, password_hash)
            if not user or not password_valid or user.status is not UserStatus.ACTIVE:
                raise InvalidCredentials("E-mail ou senha inválidos")
            token = self._token_issuer()
            expires_at = now + (persistent_duration if remember else regular_duration)
            await uow.add_access(
                user.id, self._token_hasher(token), now, expires_at, remember
            )
            await uow.register_last_access(user.id, now)
            await uow.commit()
            return LoginResult(user, token, expires_at, remember)

    async def current_user(self, token: str | None, now: datetime) -> User:
        if not token:
            raise InvalidAccess("Acesso não autenticado")
        async with self._uow_factory() as uow:
            user = await uow.get_user_by_access(self._token_hasher(token), now)
            if not user or user.status is not UserStatus.ACTIVE:
                raise InvalidAccess("Acesso não autenticado")
            return user

    async def logout(self, token: str | None, now: datetime) -> None:
        if not token:
            return
        async with self._uow_factory() as uow:
            await uow.revoke_access(self._token_hasher(token), now)
            await uow.commit()


class UserAdministrationService:
    def __init__(self, uow_factory, password_hasher):
        self._uow_factory = uow_factory
        self._password_hasher = password_hasher

    async def create_user(
        self, name: str, email: str, password: str, role: UserRole, now: datetime
    ) -> User:
        name = name.strip()
        email = email.strip().casefold()
        if not name:
            raise ValueError("Nome é obrigatório")
        if len(password) < 12:
            raise ValueError("A senha deve possuir ao menos 12 caracteres")
        async with self._uow_factory() as uow:
            if await uow.get_user_by_email(email):
                raise ValueError("Já existe um Usuário com este e-mail")
            user = await uow.add_user(
                name, email, self._password_hasher.hash(password), role, now
            )
            await uow.commit()
            return user
