"""Adiciona estado persistente da licenca local."""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade():
    table = op.create_table(
        "estado_licenca",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "instalacao_iniciada_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("cnpj", sa.String(14), nullable=False, server_default=""),
        sa.Column("liberado", sa.Boolean(), nullable=True),
        sa.Column("validade", sa.Date(), nullable=True),
        sa.Column("cliente", sa.String(180), nullable=False, server_default=""),
        sa.Column("verificar_novamente_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ultima_verificacao_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ultimo_erro", sa.String(500), nullable=False, server_default=""),
        sa.CheckConstraint("id = 1", name="ck_estado_licenca_registro_unico"),
    )
    op.bulk_insert(table, [{"id": 1}])


def downgrade():
    op.drop_table("estado_licenca")
