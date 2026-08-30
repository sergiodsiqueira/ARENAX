"""Adiciona política de retenção dos Replays."""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "configuracoes",
        sa.Column("retencao_replays_dias", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_configuracoes_retencao_replays_positiva",
        "configuracoes",
        "retencao_replays_dias IS NULL OR retencao_replays_dias > 0",
    )


def downgrade():
    op.drop_constraint(
        "ck_configuracoes_retencao_replays_positiva", "configuracoes", type_="check"
    )
    op.drop_column("configuracoes", "retencao_replays_dias")
