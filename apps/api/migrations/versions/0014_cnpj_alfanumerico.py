"""Adapta o CNPJ ao formato alfanumérico adotado em 2026."""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("ck_configuracoes_cnpj", "configuracoes", type_="check")
    op.create_check_constraint(
        "ck_configuracoes_cnpj",
        "configuracoes",
        "cnpj = '' OR cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'",
    )


def downgrade():
    op.drop_constraint("ck_configuracoes_cnpj", "configuracoes", type_="check")
    op.create_check_constraint(
        "ck_configuracoes_cnpj",
        "configuracoes",
        "cnpj = '' OR cnpj ~ '^[0-9]{14}$'",
    )
