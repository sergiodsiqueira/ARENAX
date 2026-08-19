import argparse
import asyncio
import getpass
import os
from datetime import UTC, datetime

from arenax.application.auth import UserAdministrationService
from arenax.domain.identity import UserRole
from arenax.infrastructure.security import Argon2PasswordHasher
from arenax.infrastructure.uow import SqlAlchemyUnitOfWork


def parse_arguments():
    parser = argparse.ArgumentParser(description="Cria um Usuario da ARENAX")
    parser.add_argument("--nome", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--papel",
        choices=[role.value for role in UserRole],
        default=UserRole.OWNER.value,
    )
    return parser.parse_args()


async def create_user() -> None:
    arguments = parse_arguments()
    password = os.getenv("ARENAX_INITIAL_USER_PASSWORD") or getpass.getpass("Senha: ")
    service = UserAdministrationService(SqlAlchemyUnitOfWork, Argon2PasswordHasher())
    user = await service.create_user(
        arguments.nome,
        arguments.email,
        password,
        UserRole(arguments.papel),
        datetime.now(UTC),
    )
    print(f"Usuario criado: {user.email} ({user.role.value})")


if __name__ == "__main__":
    asyncio.run(create_user())
