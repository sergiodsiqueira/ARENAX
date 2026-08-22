"""Adiciona estado administrativo a Clientes e Equipamentos."""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("clientes", sa.Column("status_administrativo", sa.String(20), nullable=False, server_default="active"))
    op.add_column("equipamentos", sa.Column("status_administrativo", sa.String(20), nullable=False, server_default="active"))


def downgrade():
    op.drop_column("equipamentos", "status_administrativo")
    op.drop_column("clientes", "status_administrativo")
