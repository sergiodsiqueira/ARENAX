# ARENAX — Codex Development Instructions

## Product

ARENAX is an operational platform for sports arenas.

Core domain rule:

> Everything happens in a Space during a Session.

Before implementing a feature, consult the relevant documentation in `docs/`.

Start with:

- `docs/README.md`
- `docs/02-Domain/Domain-Book.md`
- `docs/02-Domain/Ubiquitous-Language.md`
- `docs/02-Domain/ADRs/`
- `docs/03-Architecture/Architecture.md`
- `docs/06-Planning/Product-Backlog.md`

For frontend or visual work, also read `docs/04-UX/Design-System.md`. Its
Stravix-inspired palette and layout direction are the official visual reference.

## Architecture

The project follows:

- Domain-Driven Design as modeling guidance.
- Clean Architecture / Ports and Adapters.
- Modular Monolith for the MVP.
- API First.
- Domain events for meaningful state changes.

Business rules must not be duplicated in the frontend, database, firmware, or transport layer.

## Core Domain

`Session` is the main Aggregate Root.

A Session contextualizes:

- Responsible Person
- Spaces
- Payments
- Moments
- Replays
- Events
- Occurrences
- Timeline

Use the official ubiquitous language. Do not introduce synonyms such as `Reservation`
when the domain term is `Session`, unless an ADR explicitly changes that decision.

## Hardware

ESP32/AX Devices publish physical events only.

Firmware must not know:

- camera URLs
- the active Session
- replay duration
- storage paths
- business rules

## Engineering Rules

Before coding, determine:

1. Which bounded context owns the feature?
2. Which aggregate/entity is responsible?
3. Which invariants must be protected?
4. Which domain event(s) should be emitted?
5. Which ADRs apply?
6. Which automated tests prove the business behavior?

Prefer the simplest implementation that preserves the documented architecture.

Do not create microservices without an explicit architectural decision.

When implementation and documentation disagree, do not silently invent a new rule.
Call out the conflict and propose updating the relevant ADR/domain document.
