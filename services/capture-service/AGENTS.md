# ARENAX Capture Service — Codex Instructions

The Capture Service maintains access to camera streams and enough buffered media
to generate retroactive Replays.

## Responsibilities

- Connect to configured camera streams.
- Maintain a rolling buffer or equivalent capture strategy.
- Expose media segments needed by the Replay Worker.
- Report camera/capture health.

## Rules

- Camera URLs come from configuration/persistence, never hard-coded.
- A Space may have multiple cameras.
- The service does not decide whether a button press is valid.
- The service does not own Session business rules.
- Buffer strategy must support configurable pre-event and post-event durations.

See `docs/05-Hardware/Replay-Flow.md`.
