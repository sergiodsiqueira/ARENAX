"""Adiciona observações ao cadastro de Clientes."""

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "clientes",
        sa.Column("observacoes", sa.Text(), nullable=False, server_default=""),
    )


def downgrade():
    op.drop_column("clientes", "observacoes")
