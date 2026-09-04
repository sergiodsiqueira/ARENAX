"""Traduz o esquema fisico do PostgreSQL para PT-BR.

Revision ID: 0002
Revises: 0001
"""

from alembic import op


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


TABLES = (
    ("people", "pessoas"),
    ("spaces", "espacos"),
    ("equipments", "equipamentos"),
    ("sessions", "sessoes"),
    ("session_spaces", "sessao_espacos"),
    ("moments", "momentos"),
    ("physical_events", "eventos_fisicos"),
    ("timeline", "linha_do_tempo"),
    ("outbox", "caixa_de_saida"),
)

COLUMNS = {
    "pessoas": (("name", "nome"),),
    "espacos": (("name", "nome"), ("administrative_status", "status_administrativo")),
    "equipamentos": (
        ("space_id", "espaco_id"),
        ("kind", "tipo"),
        ("external_id", "identificador_externo"),
        ("configuration", "configuracao"),
    ),
    "sessoes": (
        ("responsible_person_id", "responsavel_id"),
        ("scheduled_start", "inicio_previsto"),
        ("scheduled_end", "fim_previsto"),
        ("actual_start", "inicio_real"),
        ("actual_end", "fim_real"),
    ),
    "sessao_espacos": (("session_id", "sessao_id"), ("space_id", "espaco_id")),
    "momentos": (
        ("session_id", "sessao_id"),
        ("space_id", "espaco_id"),
        ("occurred_at", "ocorrido_em"),
        ("replay_path", "caminho_replay"),
    ),
    "eventos_fisicos": (
        ("device_id", "dispositivo_id"),
        ("occurred_at", "ocorrido_em"),
        ("idempotency_key", "chave_idempotencia"),
        ("accepted", "aceito"),
        ("moment_id", "momento_id"),
    ),
    "linha_do_tempo": (
        ("session_id", "sessao_id"),
        ("kind", "tipo"),
        ("occurred_at", "ocorrido_em"),
        ("data", "dados"),
    ),
    "caixa_de_saida": (
        ("kind", "tipo"),
        ("aggregate_id", "agregado_id"),
        ("payload", "dados"),
        ("published_at", "publicado_em"),
    ),
}


def upgrade():
    for original, translated in TABLES:
        op.rename_table(original, translated)
    for table, columns in COLUMNS.items():
        for original, translated in columns:
            op.alter_column(table, original, new_column_name=translated)


def downgrade():
    for table, columns in reversed(tuple(COLUMNS.items())):
        for original, translated in reversed(columns):
            op.alter_column(table, translated, new_column_name=original)
    for original, translated in reversed(TABLES):
        op.rename_table(translated, original)
