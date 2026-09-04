"""Adiciona a interface de rede usada pelos AX Devices."""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "configuracoes",
        sa.Column("interface_rede_ax_device_id", sa.String(120), nullable=False, server_default=""),
    )
    op.add_column(
        "configuracoes",
        sa.Column("interface_rede_ax_device_nome", sa.String(160), nullable=False, server_default=""),
    )
    op.add_column(
        "configuracoes",
        sa.Column("endereco_rede_ax_device", sa.String(45), nullable=False, server_default=""),
    )


def downgrade():
    op.drop_column("configuracoes", "endereco_rede_ax_device")
    op.drop_column("configuracoes", "interface_rede_ax_device_nome")
    op.drop_column("configuracoes", "interface_rede_ax_device_id")
