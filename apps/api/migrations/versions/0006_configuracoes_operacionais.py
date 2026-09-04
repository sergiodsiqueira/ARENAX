"""Adiciona configurações operacionais globais da Arena."""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    configuracoes = op.create_table(
        "configuracoes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("duracao_padrao_sessao_minutos", sa.Integer(), nullable=False),
        sa.Column("duracao_replay_anterior_segundos", sa.Integer(), nullable=False),
        sa.Column("duracao_replay_posterior_segundos", sa.Integer(), nullable=False),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("id = 1", name="ck_configuracoes_registro_unico"),
        sa.CheckConstraint(
            "duracao_padrao_sessao_minutos > 0",
            name="ck_configuracoes_duracao_sessao_positiva",
        ),
        sa.CheckConstraint(
            "duracao_replay_anterior_segundos >= 0",
            name="ck_configuracoes_replay_anterior_nao_negativa",
        ),
        sa.CheckConstraint(
            "duracao_replay_posterior_segundos >= 0",
            name="ck_configuracoes_replay_posterior_nao_negativa",
        ),
        sa.CheckConstraint(
            "duracao_replay_anterior_segundos + duracao_replay_posterior_segundos > 0",
            name="ck_configuracoes_duracao_replay_positiva",
        ),
    )
    op.bulk_insert(
        configuracoes,
        [
            {
                "id": 1,
                "duracao_padrao_sessao_minutos": 60,
                "duracao_replay_anterior_segundos": 30,
                "duracao_replay_posterior_segundos": 5,
            }
        ],
    )


def downgrade():
    op.drop_table("configuracoes")
