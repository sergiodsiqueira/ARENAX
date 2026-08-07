# ARENAX AX Device Firmware — Codex Instructions

The ESP32 is an event publisher, not a business-rules engine.

## Main Flow

```text
button pressed
  -> identify device
  -> POST physical event
  -> receive technical acknowledgement
```

## Never implement in firmware

- active Session lookup
- camera selection
- RTSP URLs
- replay duration
- storage location
- payment/session rules

## Expected Event

Conceptually:

`POST /api/v1/events/button-pressed`

with device identity and event timestamp.

Network configuration and credentials must be handled securely and separately
from domain behavior.

See `docs/05-Hardware/ESP32.md` and ADR-007/ADR-009.
