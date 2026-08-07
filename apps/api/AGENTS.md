# ARENAX API — Codex Instructions

## Stack

- Python
- FastAPI
- SQLAlchemy 2
- PostgreSQL
- Alembic
- Pytest
- Redis when queue/cache behavior is required

## Layers

Keep dependencies pointing inward:

```text
api -> application -> domain
infrastructure -> application/domain ports
```

The Domain Layer must not import FastAPI, SQLAlchemy, Redis, HTTP concepts, or database models.

## Rules

- Business invariants belong to domain/application logic.
- API schemas/DTOs are not domain entities.
- SQLAlchemy models are persistence concerns.
- Repository interfaces/ports must not depend on SQLAlchemy.
- Transactions should be scoped to application use cases.
- Domain behavior requires automated tests.
- Follow API First contracts and the official ubiquitous language.
- Session is the primary aggregate for operational behavior.

Before changing API behavior, inspect `docs/02-Domain/` and `docs/03-Architecture/`.
