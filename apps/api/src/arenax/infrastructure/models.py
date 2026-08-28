from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class OperationalSettingsModel(Base):
    __tablename__ = "configuracoes"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_configuracoes_registro_unico"),
        CheckConstraint(
            "duracao_padrao_sessao_minutos > 0",
            name="ck_configuracoes_duracao_sessao_positiva",
        ),
        CheckConstraint(
            "duracao_replay_anterior_segundos >= 0",
            name="ck_configuracoes_replay_anterior_nao_negativa",
        ),
        CheckConstraint(
            "duracao_replay_posterior_segundos >= 0",
            name="ck_configuracoes_replay_posterior_nao_negativa",
        ),
        CheckConstraint(
            "duracao_replay_anterior_segundos + duracao_replay_posterior_segundos > 0",
            name="ck_configuracoes_duracao_replay_positiva",
        ),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    default_session_duration_minutes: Mapped[int] = mapped_column(
        "duracao_padrao_sessao_minutos", Integer
    )
    replay_pre_duration_seconds: Mapped[int] = mapped_column(
        "duracao_replay_anterior_segundos", Integer
    )
    replay_post_duration_seconds: Mapped[int] = mapped_column(
        "duracao_replay_posterior_segundos", Integer
    )
    calculate_actual_time: Mapped[bool] = mapped_column(
        "calcular_tempo_real", Boolean, default=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        "atualizado_em", DateTime(timezone=True)
    )


class ClientModel(Base):
    __tablename__ = "clientes"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column("nome", String(160))
    administrative_status: Mapped[str] = mapped_column("status_administrativo", String(20), default="active")


class SpaceModel(Base):
    __table_args__ = (
        CheckConstraint("valor_minuto_centavos >= 0", name="ck_espacos_valor_minuto_nao_negativo"),
    )
    __tablename__ = "espacos"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column("nome", String(120), unique=True)
    administrative_status: Mapped[str] = mapped_column(
        "status_administrativo", String(30), default="active"
    )
    minute_rate_cents: Mapped[int] = mapped_column("valor_minuto_centavos", Integer, default=0)


class EquipmentModel(Base):
    __tablename__ = "equipamentos"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    space_id: Mapped[UUID] = mapped_column("espaco_id", ForeignKey("espacos.id"), index=True)
    kind: Mapped[str] = mapped_column("tipo", String(30))
    external_id: Mapped[str] = mapped_column("identificador_externo", String(100), unique=True)
    configuration: Mapped[dict] = mapped_column("configuracao", JSON, default=dict)
    administrative_status: Mapped[str] = mapped_column("status_administrativo", String(20), default="active")


class SessionModel(Base):
    __tablename__ = "sessoes"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    responsible_client_id: Mapped[UUID] = mapped_column(
        "responsavel_id", ForeignKey("clientes.id")
    )
    status: Mapped[str] = mapped_column(String(30), index=True)
    scheduled_start: Mapped[datetime] = mapped_column(
        "inicio_previsto", DateTime(timezone=True), index=True
    )
    scheduled_end: Mapped[datetime] = mapped_column(
        "fim_previsto", DateTime(timezone=True), index=True
    )
    actual_start: Mapped[datetime | None] = mapped_column("inicio_real", DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column("fim_real", DateTime(timezone=True))
    expected_amount_override_cents: Mapped[int | None] = mapped_column(
        "valor_previsto_manual_centavos", Integer
    )


class SessionSpaceModel(Base):
    __tablename__ = "sessao_espacos"
    __table_args__ = (
        CheckConstraint(
            "valor_minuto_centavos >= 0",
            name="ck_sessao_espacos_valor_minuto_nao_negativo",
        ),
    )
    session_id: Mapped[UUID] = mapped_column(
        "sessao_id", ForeignKey("sessoes.id"), primary_key=True
    )
    space_id: Mapped[UUID] = mapped_column(
        "espaco_id", ForeignKey("espacos.id"), primary_key=True, index=True
    )
    minute_rate_cents: Mapped[int] = mapped_column("valor_minuto_centavos", Integer, default=0)


class PhysicalEventModel(Base):
    __tablename__ = "eventos_fisicos"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    device_id: Mapped[str] = mapped_column("dispositivo_id", String(100), index=True)
    occurred_at: Mapped[datetime] = mapped_column("ocorrido_em", DateTime(timezone=True))
    idempotency_key: Mapped[str] = mapped_column("chave_idempotencia", String(160), unique=True)
    accepted: Mapped[bool] = mapped_column("aceito", Boolean)
    moment_id: Mapped[UUID | None] = mapped_column("momento_id", PGUUID(as_uuid=True))


class MomentModel(Base):
    __tablename__ = "momentos"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    session_id: Mapped[UUID] = mapped_column("sessao_id", ForeignKey("sessoes.id"), index=True)
    space_id: Mapped[UUID] = mapped_column("espaco_id", ForeignKey("espacos.id"))
    occurred_at: Mapped[datetime] = mapped_column("ocorrido_em", DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30))
    replay_path: Mapped[str | None] = mapped_column("caminho_replay", String(500))


class PaymentModel(Base):
    __tablename__ = "pagamentos"
    __table_args__ = (
        CheckConstraint("valor_centavos > 0", name="ck_pagamentos_valor_positivo"),
        CheckConstraint(
            "metodo IN ('cash', 'pix', 'debit_card', 'credit_card', 'other')",
            name="ck_pagamentos_metodo",
        ),
    )
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    session_id: Mapped[UUID] = mapped_column("sessao_id", ForeignKey("sessoes.id"), index=True)
    amount_cents: Mapped[int] = mapped_column("valor_centavos", Integer)
    method: Mapped[str] = mapped_column("metodo", String(30))
    note: Mapped[str | None] = mapped_column("observacao", String(500))
    registered_at: Mapped[datetime] = mapped_column("registrado_em", DateTime(timezone=True), index=True)
    registered_by: Mapped[UUID] = mapped_column("registrado_por", ForeignKey("usuarios.id"))


class TimelineModel(Base):
    __tablename__ = "linha_do_tempo"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column("sessao_id", ForeignKey("sessoes.id"), index=True)
    kind: Mapped[str] = mapped_column("tipo", String(80))
    occurred_at: Mapped[datetime] = mapped_column(
        "ocorrido_em", DateTime(timezone=True), index=True
    )
    data: Mapped[dict] = mapped_column("dados", JSON, default=dict)


class OutboxModel(Base):
    __tablename__ = "caixa_de_saida"
    __table_args__ = (UniqueConstraint("tipo", "agregado_id"),)
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column("tipo", String(80))
    aggregate_id: Mapped[UUID] = mapped_column("agregado_id", PGUUID(as_uuid=True))
    payload: Mapped[dict] = mapped_column("dados", JSON)
    published_at: Mapped[datetime | None] = mapped_column(
        "publicado_em", DateTime(timezone=True)
    )


class UserModel(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint(
            "papel IN ('proprietario', 'administrador', 'operador')",
            name="ck_usuarios_papel",
        ),
        CheckConstraint(
            "status IN ('ativo', 'bloqueado', 'desativado')",
            name="ck_usuarios_status",
        ),
    )
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column("nome", String(160))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column("senha_hash", String(500))
    role: Mapped[str] = mapped_column("papel", String(30))
    status: Mapped[str] = mapped_column(String(30), default="ativo")
    created_at: Mapped[datetime] = mapped_column("criado_em", DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column("atualizado_em", DateTime(timezone=True))
    last_access_at: Mapped[datetime | None] = mapped_column(
        "ultimo_acesso_em", DateTime(timezone=True)
    )


class AccessModel(Base):
    __tablename__ = "acessos"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        "usuario_id", ForeignKey("usuarios.id"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column("criado_em", DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column("expira_em", DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column("revogado_em", DateTime(timezone=True))
    persistent: Mapped[bool] = mapped_column("persistente", Boolean, default=False)
