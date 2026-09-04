"""Adiciona endereço ao cadastro de Clientes."""

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    for column in (
        sa.Column("cep", sa.String(8), nullable=False, server_default=""),
        sa.Column("endereco", sa.String(250), nullable=False, server_default=""),
        sa.Column("cidade", sa.String(120), nullable=False, server_default=""),
        sa.Column("uf", sa.String(2), nullable=False, server_default=""),
    ):
        op.add_column("clientes", column)
    op.create_check_constraint("ck_clientes_cep", "clientes", "cep = '' OR length(cep) = 8")
    op.create_check_constraint("ck_clientes_uf", "clientes", "uf = '' OR length(uf) = 2")


def downgrade():
    op.drop_constraint("ck_clientes_uf", "clientes", type_="check")
    op.drop_constraint("ck_clientes_cep", "clientes", type_="check")
    for column in ("uf", "cidade", "endereco", "cep"):
        op.drop_column("clientes", column)
