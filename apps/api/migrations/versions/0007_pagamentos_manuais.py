"""Adiciona pagamentos manuais associados a Sessões."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pagamentos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sessao_id", sa.Uuid(), sa.ForeignKey("sessoes.id"), nullable=False),
        sa.Column("valor_centavos", sa.Integer(), nullable=False),
        sa.Column("metodo", sa.String(30), nullable=False),
        sa.Column("observacao", sa.String(500), nullable=True),
        sa.Column("registrado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("registrado_por", sa.Uuid(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.CheckConstraint("valor_centavos > 0", name="ck_pagamentos_valor_positivo"),
        sa.CheckConstraint(
            "metodo IN ('cash', 'pix', 'debit_card', 'credit_card', 'other')",
            name="ck_pagamentos_metodo",
        ),
    )
    op.create_index("ix_pagamentos_sessao_id", "pagamentos", ["sessao_id"])
    op.create_index("ix_pagamentos_registrado_em", "pagamentos", ["registrado_em"])


def downgrade():
    op.drop_index("ix_pagamentos_registrado_em", table_name="pagamentos")
    op.drop_index("ix_pagamentos_sessao_id", table_name="pagamentos")
    op.drop_table("pagamentos")
