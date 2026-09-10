"""Adiciona tokens locais de redefinicao de senha."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tokens_redefinicao_senha",
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
        sa.Column("usado_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_tokens_redefinicao_senha_usuario_id",
        "tokens_redefinicao_senha",
        ["usuario_id"],
    )
    op.create_index(
        "ix_tokens_redefinicao_senha_token_hash",
        "tokens_redefinicao_senha",
        ["token_hash"],
        unique=True,
    )


def downgrade():
    op.drop_index("ix_tokens_redefinicao_senha_token_hash", "tokens_redefinicao_senha")
    op.drop_index("ix_tokens_redefinicao_senha_usuario_id", "tokens_redefinicao_senha")
    op.drop_table("tokens_redefinicao_senha")
