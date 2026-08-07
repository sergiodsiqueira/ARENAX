"""Initial ARENAX vertical slice.

Revision ID: 0001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("people", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
                    sa.Column("name", sa.String(160), nullable=False))
    op.create_table("spaces", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("administrative_status", sa.String(30), nullable=False))
    op.create_table("equipments", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("spaces.id"), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False), sa.Column("external_id", sa.String(100), unique=True),
        sa.Column("configuration", sa.JSON(), nullable=False))
    op.create_table("sessions", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("responsible_person_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("people.id")),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_start", sa.DateTime(timezone=True)), sa.Column("actual_end", sa.DateTime(timezone=True)),
        sa.CheckConstraint("scheduled_end > scheduled_start", name="ck_session_period"))
    op.create_table("session_spaces",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id"), primary_key=True),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("spaces.id"), primary_key=True))
    op.create_table("moments", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id")),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("spaces.id")),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(30), nullable=False), sa.Column("replay_path", sa.String(500)))
    op.create_table("physical_events", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("device_id", sa.String(100), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idempotency_key", sa.String(160), nullable=False, unique=True),
        sa.Column("accepted", sa.Boolean(), nullable=False),
        sa.Column("moment_id", postgresql.UUID(as_uuid=True)))
    op.create_table("timeline", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id")),
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False), sa.Column("data", sa.JSON()))
    op.create_table("outbox", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("aggregate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False), sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("kind", "aggregate_id"))
    for table, columns in {"equipments": ["space_id"], "sessions": ["status", "scheduled_start", "scheduled_end"],
        "session_spaces": ["space_id"], "moments": ["session_id"], "timeline": ["session_id", "occurred_at"]}.items():
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade():
    for table in ["outbox", "timeline", "physical_events", "moments", "session_spaces",
                  "sessions", "equipments", "spaces", "people"]:
        op.drop_table(table)

