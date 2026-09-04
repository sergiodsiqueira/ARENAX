"""Adiciona CEP aos dados cadastrais da empresa."""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "configuracoes",
        sa.Column("cep", sa.String(8), nullable=False, server_default=""),
    )
    op.create_check_constraint(
        "ck_configuracoes_cep", "configuracoes", "cep = '' OR length(cep) = 8"
    )


def downgrade():
    op.drop_constraint("ck_configuracoes_cep", "configuracoes", type_="check")
    op.drop_column("configuracoes", "cep")
