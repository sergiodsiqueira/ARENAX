"""Garante unicidade dos Documentos informados pelos Clientes."""

from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "uq_clientes_documento_informado",
        "clientes",
        ["documento"],
        unique=True,
        postgresql_where="documento <> ''",
    )


def downgrade():
    op.drop_index("uq_clientes_documento_informado", table_name="clientes")
