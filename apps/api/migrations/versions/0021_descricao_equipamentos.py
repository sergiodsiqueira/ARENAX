"""Adiciona descricao amigavel aos Equipamentos."""

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "equipamentos",
        sa.Column("descricao", sa.String(160), nullable=False, server_default=""),
    )


def downgrade():
    op.drop_column("equipamentos", "descricao")
