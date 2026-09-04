"""Adiciona tipo e documento ao cadastro de Clientes."""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "clientes", sa.Column("tipo", sa.String(1), nullable=False, server_default="F")
    )
    op.add_column(
        "clientes", sa.Column("documento", sa.String(14), nullable=False, server_default="")
    )
    op.create_check_constraint("ck_clientes_tipo", "clientes", "tipo IN ('F', 'J')")
    op.create_check_constraint(
        "ck_clientes_documento",
        "clientes",
        "documento = '' OR "
        "(tipo = 'F' AND documento ~ '^[0-9]{11}$') OR "
        "(tipo = 'J' AND documento ~ '^[A-Z0-9]{12}[0-9]{2}$')",
    )


def downgrade():
    op.drop_constraint("ck_clientes_documento", "clientes", type_="check")
    op.drop_constraint("ck_clientes_tipo", "clientes", type_="check")
    op.drop_column("clientes", "documento")
    op.drop_column("clientes", "tipo")
