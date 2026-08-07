# ARENAX Platform

Repository foundation for the ARENAX operational platform for sports arenas.

## Codex

Start by reading `AGENTS.md`. More specific instructions exist inside application,
service, and firmware directories.

## Documentation

All product and architecture decisions are versioned under `docs/`.

Core rule:

> Everything happens in a Space during a Session.

## Vertical slice executável

Pré-requisito: Docker com Compose.

```powershell
docker compose up --build
```

A API fica em `http://localhost:8000`, com OpenAPI interativo em `/docs`. O fluxo
inicial permite cadastrar Pessoa, Espaço, Câmera/AX Device, criar e iniciar uma
Sessão e publicar `POST /api/v1/events/button-pressed` com `Idempotency-Key`.

Para uma Câmera do adapter de desenvolvimento, informe
`configuration.source_path` apontando para um arquivo visível em `/media`. Replays
são gravados em `media/replays/`.

Testes do backend:

```powershell
docker compose run --rm api pytest
```

O contrato versionado está em `docs/03-Architecture/openapi.yaml` e as decisões
temporais/de entrega estão nos ADRs 011 e 012.

## Initial Structure

```text
arenax-platform/
├── AGENTS.md
├── README.md
├── docs/
├── apps/
│   ├── api/
│   └── web/
├── services/
│   ├── replay-worker/
│   └── capture-service/
├── firmware/
│   └── esp32/
├── docker/
└── scripts/
```
