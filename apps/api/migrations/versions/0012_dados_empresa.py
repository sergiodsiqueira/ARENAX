"""Adiciona dados cadastrais da empresa às Configurações."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    columns = (
        sa.Column("cnpj", sa.String(14), nullable=False, server_default=""),
        sa.Column("nome_empresa", sa.String(180), nullable=False, server_default=""),
        sa.Column("nome_fantasia", sa.String(180), nullable=False, server_default=""),
        sa.Column("endereco", sa.String(250), nullable=False, server_default=""),
        sa.Column("cidade", sa.String(120), nullable=False, server_default=""),
        sa.Column("estado", sa.String(2), nullable=False, server_default=""),
        sa.Column("telefone", sa.String(11), nullable=False, server_default=""),
    )
    for column in columns:
        op.add_column("configuracoes", column)
    op.create_check_constraint("ck_configuracoes_cnpj", "configuracoes", "cnpj = '' OR length(cnpj) = 14")
    op.create_check_constraint(
        "ck_configuracoes_telefone", "configuracoes", "telefone = '' OR length(telefone) IN (10, 11)"
    )
    op.create_check_constraint("ck_configuracoes_estado", "configuracoes", "estado = '' OR length(estado) = 2")


def downgrade():
    for constraint in ("ck_configuracoes_estado", "ck_configuracoes_telefone", "ck_configuracoes_cnpj"):
        op.drop_constraint(constraint, "configuracoes", type_="check")
    for column in ("telefone", "estado", "cidade", "endereco", "nome_fantasia", "nome_empresa", "cnpj"):
        op.drop_column("configuracoes", column)
