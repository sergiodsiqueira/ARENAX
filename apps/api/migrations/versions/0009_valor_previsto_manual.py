"""Permite valor previsto manual por Sessão."""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "sessoes",
        sa.Column("valor_previsto_manual_centavos", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_sessoes_valor_previsto_manual_nao_negativo",
        "sessoes",
        "valor_previsto_manual_centavos >= 0",
    )


def downgrade():
    op.drop_constraint(
        "ck_sessoes_valor_previsto_manual_nao_negativo", "sessoes", type_="check"
    )
    op.drop_column("sessoes", "valor_previsto_manual_centavos")
