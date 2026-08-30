from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from arenax.domain.errors import (
    ClientInUse,
    EntityNotFound,
    InactiveSpace,
    SessionConflict,
    SpaceInUse,
)
from arenax.domain.moment import Moment
from arenax.domain.payment import Payment, PaymentMethod
from arenax.domain.session import Session


@dataclass(frozen=True)
class ButtonPressResult:
    accepted: bool
    reason: str
    moment_id: UUID | None = None
    session_id: UUID | None = None


class SessionService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    async def create(
        self,
        responsible_client_id: UUID,
        space_ids: tuple[UUID, ...],
        start: datetime,
        end: datetime,
        now: datetime,
    ) -> Session:
        session = Session(responsible_client_id, space_ids, start, end)
        session._record("SessionCreated", now)
        async with self._uow_factory() as uow:
            await uow.lock_spaces(space_ids)
            if not await uow.spaces_are_active(space_ids):
                raise InactiveSpace("Only active Spaces can be scheduled")
            if await uow.has_conflict(space_ids, start, end):
                raise SessionConflict("One or more Spaces are unavailable in this period")
            await uow.add_session(session)
            await uow.add_timeline(session.id, "SessionCreated", now, {})
            await uow.commit()
        return session

    async def dossier(self, session_id: UUID, now: datetime) -> dict:
        async with self._uow_factory() as uow:
            dossier = await uow.session_dossier(session_id, now)
            if dossier is None:
                raise EntityNotFound("Session not found")
            return dossier

    async def agenda(
        self, start: datetime, end: datetime, space_id: UUID | None = None
    ) -> list[Session]:
        Session._require_aware(start)
        Session._require_aware(end)
        if end <= start:
            raise ValueError("end must be after start")
        async with self._uow_factory() as uow:
            return await uow.list_sessions(start, end, space_id)

    async def in_progress(self) -> list[Session]:
        async with self._uow_factory() as uow:
            return await uow.list_in_progress_sessions()

    async def transition(self, session_id: UUID, action: str, now: datetime, new_end=None) -> Session | None:
        async with self._uow_factory() as uow:
            session = await uow.get_session(session_id, lock=True)
            if not session:
                raise EntityNotFound("Session not found")
            await uow.lock_spaces(session.space_ids)
            if action == "start":
                session.start(now)
            elif action == "confirm":
                session.confirm(now)
            elif action == "finish":
                session.finish(now)
            elif action == "cancel":
                if not await uow.session_has_associated_events(session.id):
                    await uow.delete_session(session.id)
                    await uow.commit()
                    return None
                session.cancel(now)
            elif action == "no_show":
                session.mark_no_show(now)
            elif action == "extend":
                if new_end is None:
                    raise ValueError("new_end is required")
                if await uow.has_conflict(
                    session.space_ids, session.scheduled_end, new_end, exclude=session.id
                ):
                    raise SessionConflict("The extension conflicts with another Session")
                session.extend(new_end, now)
            else:
                raise ValueError("Unknown Session action")
            await uow.save_session(session)
            await uow.add_timeline(session.id, session.events[-1].name, now, {})
            await uow.commit()
        return session


class PhysicalEventService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    async def button_pressed(
        self, device_id: str, occurred_at: datetime, idempotency_key: str
    ) -> ButtonPressResult:
        async with self._uow_factory() as uow:
            previous = await uow.physical_event_result(idempotency_key)
            if previous is not None:
                accepted, moment_id = previous
                return ButtonPressResult(accepted, "already_processed", moment_id=moment_id)
            space_id = await uow.resolve_device_space(device_id)
            if not space_id:
                await uow.record_physical_event(device_id, occurred_at, idempotency_key, False)
                await uow.commit()
                return ButtonPressResult(False, "unknown_device")
            session = await uow.active_session_for_space(space_id, occurred_at)
            if not session:
                await uow.record_physical_event(device_id, occurred_at, idempotency_key, False)
                await uow.commit()
                return ButtonPressResult(False, "no_active_session")
            moment = Moment(session.id, space_id, occurred_at)
            await uow.record_physical_event(
                device_id, occurred_at, idempotency_key, True, moment.id
            )
            await uow.add_moment(moment)
            await uow.add_timeline(session.id, "MomentRequested", occurred_at, {"momentId": str(moment.id)})
            await uow.add_outbox(
                "ReplayRequested",
                moment.id,
                {"momentId": str(moment.id), "sessionId": str(session.id), "spaceId": str(space_id)},
            )
            await uow.commit()
            return ButtonPressResult(True, "moment_requested", moment.id, session.id)


class PaymentService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    async def register(
        self,
        session_id: UUID,
        amount_cents: int,
        method: str,
        note: str | None,
        registered_by: UUID,
        now: datetime,
    ) -> Payment:
        try:
            payment_method = PaymentMethod(method)
        except ValueError as exc:
            raise ValueError("Payment method is invalid") from exc
        payment = Payment(
            session_id=session_id,
            amount_cents=amount_cents,
            method=payment_method,
            note=note,
            registered_by=registered_by,
            registered_at=now,
        )
        async with self._uow_factory() as uow:
            if not await uow.get_session(session_id, lock=True):
                raise EntityNotFound("Session not found")
            await uow.add_payment(payment)
            await uow.add_timeline(
                session_id,
                "PaymentRegistered",
                now,
                {"paymentId": str(payment.id), "amountCents": amount_cents},
            )
            await uow.commit()
        return payment

    async def change_expected_amount(
        self, session_id: UUID, amount_cents: int, changed_by: UUID, now: datetime
    ) -> int:
        if isinstance(amount_cents, bool) or amount_cents < 0:
            raise ValueError("Expected amount cannot be negative")
        async with self._uow_factory() as uow:
            if not await uow.get_session(session_id, lock=True):
                raise EntityNotFound("Session not found")
            previous = await uow.session_expected_amount(session_id, now)
            await uow.set_expected_amount_override(session_id, amount_cents)
            await uow.add_timeline(
                session_id,
                "ExpectedAmountChanged",
                now,
                {
                    "previousAmountCents": previous,
                    "amountCents": amount_cents,
                    "changedBy": str(changed_by),
                },
            )
            await uow.commit()
        return amount_cents

    async def recalculate_expected_amount(
        self, session_id: UUID, changed_by: UUID, now: datetime
    ) -> int:
        async with self._uow_factory() as uow:
            if not await uow.get_session(session_id, lock=True):
                raise EntityNotFound("Session not found")
            previous = await uow.session_expected_amount(session_id, now)
            amount_cents = await uow.recalculate_session_expected_amount(session_id, now)
            await uow.add_timeline(
                session_id,
                "ExpectedAmountRecalculated",
                now,
                {
                    "previousAmountCents": previous,
                    "amountCents": amount_cents,
                    "changedBy": str(changed_by),
                },
            )
            await uow.commit()
        return amount_cents


class ReplaySharingService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    async def register_share(
        self, moment_id: UUID, user_id: UUID, now: datetime
    ) -> UUID:
        async with self._uow_factory() as uow:
            replay = await uow.get_moment_replay(moment_id, lock=True)
            if replay is None or replay["status"] != "ready" or not replay["replay_path"]:
                raise EntityNotFound("Replay não encontrado")
            await uow.add_timeline(
                replay["session_id"],
                "ReplayShared",
                now,
                {"momentId": str(moment_id), "sharedBy": str(user_id)},
            )
            await uow.commit()
            return replay["session_id"]


class ArenaInfrastructureService:
    def __init__(self, uow_factory):
        self._uow_factory = uow_factory

    async def create_client(
        self, name: str, client_type: str = "F", document: str = "",
        postal_code: str = "", address: str = "", city: str = "", state: str = "",
        notes: str = "", phone: str = "", email: str = "", whatsapp: bool = False,
        administrative_status: str = "active",
        *, allow_legacy_blank_document: bool = False,
    ) -> UUID:
        name = name.strip()
        if not name:
            raise ValueError("Nome do Cliente é obrigatório")
        document = self._validate_client_document(
            client_type, document, required=False
        )
        postal_code, address, city, state = self._validate_client_address(
            postal_code, address, city, state
        )
        notes = str(notes or "").strip()
        phone, email, whatsapp = self._validate_client_contact(phone, email, whatsapp)
        self._validate_binary_status(administrative_status, "Cliente")
        async with self._uow_factory() as uow:
            entity_id = await uow.add_client(
                name, client_type, document, postal_code, address, city, state,
                notes, phone, email, whatsapp, administrative_status,
            )
            await uow.commit()
            return entity_id

    async def create_space(
        self, name: str, minute_rate_cents: int = 0,
        administrative_status: str = "active",
    ) -> UUID:
        name = name.strip()
        if not name:
            raise ValueError("Nome do Espaço é obrigatório")
        self._validate_minute_rate(minute_rate_cents)
        if administrative_status not in {"active", "disabled"}:
            raise ValueError("Estado administrativo do Espaço é inválido")
        async with self._uow_factory() as uow:
            entity_id = await uow.add_space(name, minute_rate_cents, administrative_status)
            await uow.commit()
            return entity_id

    async def update_space(
        self, space_id: UUID, name: str, administrative_status: str,
        minute_rate_cents: int = 0,
    ) -> dict:
        name = name.strip()
        if not name:
            raise ValueError("Nome do Espaço é obrigatório")
        if administrative_status not in {"active", "maintenance", "disabled"}:
            raise ValueError("Estado administrativo do Espaço é inválido")
        self._validate_minute_rate(minute_rate_cents)
        async with self._uow_factory() as uow:
            if not await uow.get_space(space_id, lock=True):
                raise EntityNotFound("Espaço não encontrado")
            space = await uow.update_space(
                space_id, name, administrative_status, minute_rate_cents
            )
            await uow.commit()
            return space

    @staticmethod
    def _validate_minute_rate(minute_rate_cents: int) -> None:
        if isinstance(minute_rate_cents, bool) or minute_rate_cents < 0:
            raise ValueError("O valor por minuto do Espaço não pode ser negativo")

    async def delete_space(self, space_id: UUID) -> None:
        async with self._uow_factory() as uow:
            if not await uow.get_space(space_id, lock=True):
                raise EntityNotFound("Espaço não encontrado")
            if await uow.space_has_dependencies(space_id):
                raise SpaceInUse("Espaço possui Sessões ou Equipamentos vinculados")
            await uow.delete_space(space_id)
            await uow.commit()

    async def create_equipment(
        self, space_id: UUID, kind: str, external_id: str, configuration: dict
    ) -> UUID:
        external_id = self._validate_equipment(kind, external_id, configuration)
        async with self._uow_factory() as uow:
            if not await uow.get_space(space_id):
                raise EntityNotFound("Espaço não encontrado")
            entity_id = await uow.add_equipment(space_id, kind, external_id, configuration)
            await uow.commit()
            return entity_id

    async def update_equipment(
        self, equipment_id: UUID, space_id: UUID, kind: str, external_id: str, configuration: dict, administrative_status: str = "active"
    ) -> dict:
        external_id = self._validate_equipment(kind, external_id, configuration)
        self._validate_binary_status(administrative_status, "Equipamento")
        async with self._uow_factory() as uow:
            if not await uow.get_equipment(equipment_id, lock=True):
                raise EntityNotFound("Equipamento não encontrado")
            if not await uow.get_space(space_id):
                raise EntityNotFound("Espaço não encontrado")
            equipment = await uow.update_equipment(
                equipment_id, space_id, kind, external_id, configuration, administrative_status
            )
            await uow.commit()
            return equipment

    async def delete_equipment(self, equipment_id: UUID) -> None:
        async with self._uow_factory() as uow:
            if not await uow.get_equipment(equipment_id, lock=True):
                raise EntityNotFound("Equipamento não encontrado")
            await uow.delete_equipment(equipment_id)
            await uow.commit()

    @staticmethod
    def _validate_equipment(kind: str, external_id: str, configuration: dict) -> str:
        if kind not in {"camera", "ax_device"}:
            raise ValueError("Tipo do Equipamento deve ser camera ou ax_device")
        external_id = external_id.strip()
        if not external_id:
            raise ValueError("Identificador externo do Equipamento é obrigatório")
        if not isinstance(configuration, dict):
            raise ValueError("Configuração do Equipamento deve ser um objeto")
        if kind == "camera" and not str(configuration.get("capture_url", "")).strip():
            raise ValueError("URL de captura da Câmera é obrigatória")
        return external_id

    async def list_clients(self) -> list[dict]:
        async with self._uow_factory() as uow:
            return await uow.list_clients()

    async def update_client(
        self, client_id: UUID, name: str, client_type: str = "F",
        document: str = "", postal_code: str = "", address: str = "",
        city: str = "", state: str = "", notes: str = "",
        phone: str = "", email: str = "", whatsapp: bool = False,
        administrative_status: str = "active",
    ) -> dict:
        name = name.strip()
        if not name:
            raise ValueError("Nome do Cliente é obrigatório")
        document = self._validate_client_document(client_type, document, required=False)
        postal_code, address, city, state = self._validate_client_address(
            postal_code, address, city, state
        )
        self._validate_binary_status(administrative_status, "Cliente")
        notes = str(notes or "").strip()
        phone, email, whatsapp = self._validate_client_contact(phone, email, whatsapp)
        async with self._uow_factory() as uow:
            if not await uow.get_client(client_id, lock=True):
                raise EntityNotFound("Cliente não encontrado")
            client = await uow.update_client(
                client_id, name, client_type, document, postal_code, address,
                city, state, notes, phone, email, whatsapp, administrative_status
            )
            await uow.commit()
            return client

    @staticmethod
    def _validate_client_document(
        client_type: str, document: str, *, required: bool
    ) -> str:
        if client_type not in {"F", "J"}:
            raise ValueError("Tipo do Cliente deve ser F ou J")
        normalized = "".join(
            character for character in str(document or "").upper()
            if character.isalnum() and character.isascii()
        )
        if not normalized and not required:
            return ""
        if client_type == "F" and (len(normalized) != 11 or not normalized.isdigit()):
            raise ValueError("CPF deve ter 11 dígitos")
        if client_type == "J" and (
            len(normalized) != 14
            or not normalized[:12].isalnum()
            or not normalized[-2:].isdigit()
        ):
            raise ValueError(
                "CNPJ deve ter 12 letras ou números e 2 dígitos verificadores"
            )
        return normalized

    @staticmethod
    def _validate_client_address(
        postal_code: str, address: str, city: str, state: str
    ) -> tuple[str, str, str, str]:
        postal_code = "".join(character for character in postal_code if character.isdigit())
        address, city, state = address.strip(), city.strip(), state.strip().upper()
        if postal_code and len(postal_code) != 8:
            raise ValueError("CEP deve ter 8 dígitos")
        if state and (len(state) != 2 or not state.isalpha()):
            raise ValueError("UF deve ter 2 letras")
        return postal_code, address, city, state

    @staticmethod
    def _validate_client_contact(phone: str, email: str, whatsapp: bool) -> tuple[str, str, bool]:
        phone = "".join(character for character in str(phone or "") if character.isdigit())
        email = str(email or "").strip().lower()
        if phone and len(phone) not in {10, 11}:
            raise ValueError("Telefone deve ter 10 ou 11 dígitos")
        if email and ("@" not in email or email.startswith("@") or email.endswith("@")):
            raise ValueError("E-mail do Cliente é inválido")
        if not isinstance(whatsapp, bool):
            raise ValueError("Indicador de WhatsApp deve ser booleano")
        return phone, email, whatsapp

    async def delete_client(self, client_id: UUID) -> None:
        async with self._uow_factory() as uow:
            if not await uow.get_client(client_id, lock=True):
                raise EntityNotFound("Cliente não encontrado")
            if await uow.client_has_sessions(client_id):
                raise ClientInUse("Cliente é Responsável por uma ou mais Sessões")
            await uow.delete_client(client_id)
            await uow.commit()

    async def list_spaces(self) -> list[dict]:
        async with self._uow_factory() as uow:
            return await uow.list_spaces()

    async def list_equipments(self, space_id: UUID | None = None) -> list[dict]:
        async with self._uow_factory() as uow:
            return await uow.list_equipments(space_id)

    async def get_operational_settings(self) -> dict:
        async with self._uow_factory() as uow:
            return await uow.get_operational_settings()

    async def update_operational_settings(
        self,
        default_session_duration_minutes: int,
        replay_pre_duration_seconds: int,
        replay_post_duration_seconds: int,
        calculate_actual_time: bool,
        replay_retention_days: int | None,
        company: dict[str, str],
        now: datetime,
    ) -> dict:
        if default_session_duration_minutes <= 0:
            raise ValueError("A duração padrão da Sessão deve ser maior que zero")
        if replay_pre_duration_seconds < 0 or replay_post_duration_seconds < 0:
            raise ValueError("As durações do Replay não podem ser negativas")
        if replay_pre_duration_seconds + replay_post_duration_seconds <= 0:
            raise ValueError("A duração total do Replay deve ser maior que zero")
        if replay_retention_days is not None and (
            isinstance(replay_retention_days, bool) or replay_retention_days <= 0
        ):
            raise ValueError("A retenção dos Replays deve ser maior que zero")
        normalized_company = {
            key: str(value or "").strip() for key, value in company.items()
        }
        normalized_company["company_tax_id"] = "".join(
            character for character in normalized_company.get("company_tax_id", "").upper()
            if character.isalnum() and character.isascii()
        )
        normalized_company["company_phone"] = "".join(
            character for character in normalized_company.get("company_phone", "")
            if character.isdigit()
        )
        normalized_company["company_postal_code"] = "".join(
            character for character in normalized_company.get("company_postal_code", "")
            if character.isdigit()
        )
        normalized_company["company_state"] = normalized_company.get("company_state", "").upper()
        tax_id = normalized_company["company_tax_id"]
        if tax_id and (
            len(tax_id) != 14 or not tax_id[:12].isalnum() or not tax_id[-2:].isdigit()
        ):
            raise ValueError(
                "O CNPJ deve ter 12 letras ou números e 2 dígitos verificadores"
            )
        if normalized_company["company_phone"] and len(normalized_company["company_phone"]) not in {10, 11}:
            raise ValueError("O telefone deve ter 10 ou 11 dígitos")
        if normalized_company["company_postal_code"] and len(normalized_company["company_postal_code"]) != 8:
            raise ValueError("O CEP deve ter 8 dígitos")
        if normalized_company["company_state"] and len(normalized_company["company_state"]) != 2:
            raise ValueError("O Estado deve ser informado pela UF com duas letras")
        async with self._uow_factory() as uow:
            await uow.get_operational_settings(lock=True)
            result = await uow.update_operational_settings(
                default_session_duration_minutes,
                replay_pre_duration_seconds,
                replay_post_duration_seconds,
                calculate_actual_time,
                replay_retention_days,
                normalized_company,
                now,
            )
            await uow.commit()
            return result

    @staticmethod
    def _validate_binary_status(status: str, entity: str) -> None:
        if status not in {"active", "inactive"}:
            raise ValueError(f"Estado administrativo do {entity} é inválido")
