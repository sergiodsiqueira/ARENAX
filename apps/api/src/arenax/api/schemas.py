from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class CreateSessionRequest(BaseModel):
    responsible_client_id: UUID = Field(
        validation_alias=AliasChoices("responsible_client_id", "responsible_person_id")
    )
    space_ids: list[UUID] = Field(min_length=1)
    scheduled_start: datetime
    scheduled_end: datetime


class ExtendSessionRequest(BaseModel):
    scheduled_end: datetime


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    responsible_client_id: UUID
    space_ids: tuple[UUID, ...]
    scheduled_start: datetime
    scheduled_end: datetime
    status: str
    actual_start: datetime | None
    actual_end: datetime | None


class ButtonPressedRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=100)
    timestamp: datetime


class ButtonPressedResponse(BaseModel):
    accepted: bool
    reason: str
    moment_id: UUID | None = None
    session_id: UUID | None = None


class NamedResourceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class EquipmentRequest(BaseModel):
    space_id: UUID
    kind: str
    external_id: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=160)
    configuration: dict = Field(default_factory=dict)
    administrative_status: Literal["active", "inactive"] = "active"


class CreatedResourceResponse(BaseModel):
    id: UUID


class NamedResourceResponse(BaseModel):
    id: UUID
    name: str


class ClientResponse(NamedResourceResponse):
    client_type: Literal["F", "J"]
    document: str
    postal_code: str
    address: str
    city: str
    state: str
    notes: str
    phone: str
    email: str
    whatsapp: bool
    administrative_status: str


class CreateClientRequest(NamedResourceRequest):
    client_type: Literal["F", "J"]
    document: str = Field(default="", max_length=18)
    postal_code: str = Field(default="", max_length=9)
    address: str = Field(default="", max_length=250)
    city: str = Field(default="", max_length=120)
    state: str = Field(default="", max_length=2)
    notes: str = ""
    phone: str = Field(default="", max_length=15)
    email: str = Field(default="", max_length=320)
    whatsapp: bool = False
    administrative_status: Literal["active", "inactive"] = "active"


class UpdateClientRequest(CreateClientRequest):
    administrative_status: Literal["active", "inactive"]


class SpaceResponse(NamedResourceResponse):
    administrative_status: str
    minute_rate_cents: int


class CreateSpaceRequest(NamedResourceRequest):
    administrative_status: Literal["active", "disabled"] = "active"
    minute_rate_cents: int = Field(ge=0)


class UpdateSpaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    administrative_status: Literal["active", "maintenance", "disabled"]
    minute_rate_cents: int = Field(ge=0)


class EquipmentResponse(BaseModel):
    id: UUID
    space_id: UUID
    kind: str
    external_id: str
    description: str
    configuration: dict
    administrative_status: str


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)
    remember: bool = False


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str


class LoginResponse(BaseModel):
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_url: str | None = None
    expires_at: datetime | None = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=1024)
    password: str = Field(min_length=12, max_length=1024)


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=1024)
    role: Literal["proprietario", "administrador", "operador"]


class UpdateUserRequest(BaseModel):
    role: Literal["proprietario", "administrador", "operador"]
    status: Literal["ativo", "bloqueado", "desativado"]


class ResetUserPasswordRequest(BaseModel):
    password: str = Field(min_length=12, max_length=1024)


class AdminUserResponse(UserResponse):
    status: str
    created_at: datetime
    updated_at: datetime
    last_access_at: datetime | None


class CameraHealthResponse(BaseModel):
    camera_id: UUID
    status: str
    checked_at: datetime | None = None
    error: str | None = None


class HealthItemResponse(BaseModel):
    name: str
    label: str
    status: str
    checked_at: datetime | None = None
    detail: str | None = None
    response_time_ms: int | None = None
    total_bytes: int | None = None
    free_bytes: int | None = None
    used_percent: float | None = None


class CameraHealthItemResponse(BaseModel):
    camera_id: UUID
    external_id: str
    description: str
    space_id: UUID
    space_name: str
    administrative_status: str
    status: str
    checked_at: datetime | None = None
    detail: str | None = None


class HealthCenterResponse(BaseModel):
    status: str
    checked_at: datetime
    ax_device_api_url: str | None = None
    services: list[HealthItemResponse]
    cameras: list[CameraHealthItemResponse]


class LicenseStatusResponse(BaseModel):
    allowed: bool
    reason: str
    customer_name: str
    valid_until: date | None = None
    grace_until: datetime
    next_check_at: datetime | None = None
    check_status: Literal["consulted", "not_consulted", "unavailable"]
    support_company: str
    support_whatsapp: str
    support_email: str


class CameraLiveResponse(BaseModel):
    url: str


class OperationalSettingsInput(BaseModel):
    default_session_duration_minutes: int = Field(gt=0)
    replay_pre_duration_seconds: int = Field(ge=0)
    replay_post_duration_seconds: int = Field(ge=0)
    calculate_actual_time: bool
    replay_retention_days: int | None = Field(default=None, gt=0)
    company_tax_id: str = Field(default="", max_length=18)
    company_legal_name: str = Field(default="", max_length=180)
    company_trade_name: str = Field(default="", max_length=180)
    company_address: str = Field(default="", max_length=250)
    company_postal_code: str = Field(default="", max_length=9)
    company_city: str = Field(default="", max_length=120)
    company_state: str = Field(default="", max_length=2)
    company_phone: str = Field(default="", max_length=15)
    ax_device_network_interface_id: str = Field(default="", max_length=120)
    ax_device_network_interface_name: str = Field(default="", max_length=160)
    ax_device_network_address: str = Field(default="", max_length=45)


class OperationalSettingsResponse(OperationalSettingsInput):
    updated_at: datetime
    media_storage_path: str


class StorageFolderResponse(BaseModel):
    path: str | None
    cancelled: bool = False


class ApplyStorageFolderRequest(BaseModel):
    path: str = Field(min_length=3, max_length=1024)


class StorageChangeResponse(BaseModel):
    accepted: bool
    path: str


class NetworkInterfaceResponse(BaseModel):
    id: str
    name: str
    address: str


class PostalCodeResponse(BaseModel):
    postal_code: str
    street: str
    neighborhood: str
    city: str
    state: str


class RegisterPaymentRequest(BaseModel):
    amount_cents: int = Field(gt=0)
    method: Literal["cash", "pix", "debit_card", "credit_card", "other"]
    note: str | None = Field(default=None, max_length=500)


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    session_id: UUID
    amount_cents: int
    method: str
    note: str | None
    registered_at: datetime
    registered_by: UUID


class ChangeExpectedAmountRequest(BaseModel):
    amount_cents: int = Field(ge=0)


class ExpectedAmountResponse(BaseModel):
    amount_cents: int
