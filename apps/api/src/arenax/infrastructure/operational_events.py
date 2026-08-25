import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID


class OperationalEventBroker:
    def __init__(self, queue_size: int = 32) -> None:
        self._queue_size = queue_size
        self._subscribers: set[asyncio.Queue[str]] = set()

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[str]]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=self._queue_size)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)

    def publish(self, resource: str, entity_id: UUID | None = None) -> None:
        payload = json.dumps(
            {
                "resource": resource,
                "occurred_at": datetime.now(UTC).isoformat(),
                "entity_id": str(entity_id) if entity_id else None,
            },
            separators=(",", ":"),
        )
        for queue in tuple(self._subscribers):
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(payload)


operational_events = OperationalEventBroker()
