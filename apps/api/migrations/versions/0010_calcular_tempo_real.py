"""Adiciona configuração do cálculo por tempo real de uso."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "configuracoes",
        sa.Column(
            "calcular_tempo_real",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade():
    op.drop_column("configuracoes", "calcular_tempo_real")
