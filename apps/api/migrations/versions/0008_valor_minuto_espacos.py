"""Adiciona valor por minuto aos Espaços e snapshot nas Sessões."""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "espacos",
        sa.Column("valor_minuto_centavos", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_espacos_valor_minuto_nao_negativo", "espacos", "valor_minuto_centavos >= 0"
    )
    op.add_column(
        "sessao_espacos",
        sa.Column("valor_minuto_centavos", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_sessao_espacos_valor_minuto_nao_negativo",
        "sessao_espacos",
        "valor_minuto_centavos >= 0",
    )


def downgrade():
    op.drop_constraint(
        "ck_sessao_espacos_valor_minuto_nao_negativo", "sessao_espacos", type_="check"
    )
    op.drop_column("sessao_espacos", "valor_minuto_centavos")
    op.drop_constraint("ck_espacos_valor_minuto_nao_negativo", "espacos", type_="check")
    op.drop_column("espacos", "valor_minuto_centavos")
