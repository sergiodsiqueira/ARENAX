import json
from uuid import uuid4

import pytest

from arenax.infrastructure.operational_events import OperationalEventBroker


@pytest.mark.asyncio
async def test_broker_delivers_operational_signal_to_every_subscriber():
    broker = OperationalEventBroker()
    entity_id = uuid4()

    async with broker.subscribe() as first, broker.subscribe() as second:
        broker.publish("sessions", entity_id)

        first_payload = json.loads(await first.get())
        second_payload = json.loads(await second.get())

    assert first_payload == second_payload
    assert first_payload["resource"] == "sessions"
    assert first_payload["entity_id"] == str(entity_id)
    assert first_payload["occurred_at"].endswith("+00:00")


@pytest.mark.asyncio
async def test_broker_keeps_latest_signal_for_a_slow_subscriber():
    broker = OperationalEventBroker(queue_size=1)

    async with broker.subscribe() as queue:
        broker.publish("clients")
        broker.publish("spaces")
        payload = json.loads(await queue.get())

    assert payload["resource"] == "spaces"
