# ARENAX Replay Worker — Codex Instructions

The Replay Worker performs asynchronous video processing.

## Responsibilities

- Consume replay/moment processing jobs.
- Obtain the configured buffered video interval.
- Produce video with FFmpeg.
- Persist processing results through approved application/infrastructure boundaries.
- Emit/report `ReplayGenerated` or `ReplayGenerationFailed`.

## Rules

- Do not decide whether a Session is valid.
- Do not interpret ESP32 button presses.
- Do not embed camera configuration in code.
- Replay duration must come from configuration/domain/application data.
- Processing failure must be observable and recoverable.
- Video processing must not block the main API request lifecycle.

See `docs/05-Hardware/Replay-Flow.md`.
