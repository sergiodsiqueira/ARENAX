from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4


class MomentStatus(StrEnum):
    REQUESTED = "requested"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


@dataclass(slots=True)
class Moment:
    session_id: UUID
    space_id: UUID
    occurred_at: datetime
    id: UUID = field(default_factory=uuid4)
    status: MomentStatus = MomentStatus.REQUESTED

