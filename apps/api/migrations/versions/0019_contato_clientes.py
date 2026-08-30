"""Adiciona Telefone, E-mail e WhatsApp aos Clientes."""

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("clientes", sa.Column("telefone", sa.String(11), nullable=False, server_default=""))
    op.add_column("clientes", sa.Column("email", sa.String(320), nullable=False, server_default=""))
    op.add_column("clientes", sa.Column("whatsapp", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_check_constraint(
        "ck_clientes_telefone", "clientes",
        "telefone = '' OR length(telefone) IN (10, 11)",
    )


def downgrade():
    op.drop_constraint("ck_clientes_telefone", "clientes", type_="check")
    op.drop_column("clientes", "whatsapp")
    op.drop_column("clientes", "email")
    op.drop_column("clientes", "telefone")
