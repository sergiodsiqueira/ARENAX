from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateSessionRequest(BaseModel):
    responsible_person_id: UUID
    space_ids: list[UUID] = Field(min_length=1)
    scheduled_start: datetime
    scheduled_end: datetime


class ExtendSessionRequest(BaseModel):
    scheduled_end: datetime


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    responsible_person_id: UUID
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


class CreatedResourceResponse(BaseModel):
    id: UUID


class NamedResourceResponse(BaseModel):
    id: UUID
    name: str


class SpaceResponse(NamedResourceResponse):
    administrative_status: str


class EquipmentResponse(BaseModel):
    id: UUID
    space_id: UUID
    kind: str
    external_id: str
    configuration: dict


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
