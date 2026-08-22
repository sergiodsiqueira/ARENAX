from datetime import datetime
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
    configuration: dict = Field(default_factory=dict)
    administrative_status: Literal["active", "inactive"] = "active"


class CreatedResourceResponse(BaseModel):
    id: UUID


class NamedResourceResponse(BaseModel):
    id: UUID
    name: str


class ClientResponse(NamedResourceResponse):
    administrative_status: str


class UpdateClientRequest(NamedResourceRequest):
    administrative_status: Literal["active", "inactive"]


class SpaceResponse(NamedResourceResponse):
    administrative_status: str


class UpdateSpaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    administrative_status: Literal["active", "maintenance", "disabled"]


class EquipmentResponse(BaseModel):
    id: UUID
    space_id: UUID
    kind: str
    external_id: str
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


class CameraLiveResponse(BaseModel):
    url: str
