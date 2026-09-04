"""Adiciona Usuarios e Acessos.

Revision ID: 0003
Revises: 0002
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "usuarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nome", sa.String(160), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("senha_hash", sa.String(500), nullable=False),
        sa.Column("papel", sa.String(30), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ultimo_acesso_em", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "papel IN ('proprietario', 'administrador', 'operador')",
            name="ck_usuarios_papel",
        ),
        sa.CheckConstraint(
            "status IN ('ativo', 'bloqueado', 'desativado')",
            name="ck_usuarios_status",
        ),
    )
    op.create_index("ix_usuarios_email", "usuarios", ["email"], unique=True)
    op.create_table(
        "acessos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "usuario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revogado_em", sa.DateTime(timezone=True)),
        sa.Column("persistente", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_acessos_usuario_id", "acessos", ["usuario_id"])
    op.create_index("ix_acessos_token_hash", "acessos", ["token_hash"], unique=True)


def downgrade():
    op.drop_table("acessos")
    op.drop_table("usuarios")
