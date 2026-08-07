# ARENAX Web — Codex Instructions

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- React Hook Form
- React Router

## Product Surfaces

The three primary operational experiences are:

1. Mission Control — what is happening now?
2. Agenda — what will happen?
3. Session — the complete dossier of one usage.

Administrative experiences include Arena Designer, People, Spaces, Equipment,
Health Center, Settings, and Reports.

## Rules

- Do not implement business rules that belong to the backend/domain.
- Present server state and send user intentions.
- Use official ARENAX terminology.
- Reuse Space Node and other Design System primitives.
- Mission Control should update in real time and must not require a manual refresh button.
- Preserve operational context; prefer drawers/panels for quick Session details when appropriate.

Consult `docs/04-UX/` before implementing product screens.
