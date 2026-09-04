"""Renomeia Pessoas para Clientes.

Revision ID: 0004
Revises: 0003
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table("pessoas", "clientes")


def downgrade():
    op.rename_table("clientes", "pessoas")
