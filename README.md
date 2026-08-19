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
`configuration.capture_url` com uma URL RTSP ou arquivo visível em `/media`. O
Capture Service mantém segmentos em `media/buffers/`, aplica retenção e publica
saúde em `media/capture-health/`. Replays são gravados em `media/replays/`.
O MediaMTX recebe publicações RTSP do host em `rtsp://localhost:8554/<path>`.
Para publicar temporariamente a webcam do navegador, abra
`http://localhost:8889/live/publish` e permita o acesso à câmera.

Testes do backend:

```powershell
docker compose run --rm api pytest
```

Validação ponta a ponta da vertical slice (inclui testes, Sessão, AX Event,
idempotência, Momento, Timeline e geração de Replay):

```powershell
.\scripts\smoke-test.ps1
```

O smoke test cria dados identificados por `Smoke Test` no banco local e remove os
arquivos de vídeo sintéticos ao terminar.

O contrato versionado está em `docs/03-Architecture/openapi.yaml` e as decisões
temporais/de entrega estão nos ADRs 011 e 012.

## Primeiro acesso

Após executar as migrations, crie o primeiro proprietário sem registrar a senha
no histórico do terminal:

```powershell
docker compose run --rm api python -m arenax.cli.create_user `
  --nome "Proprietário" `
  --email "proprietario@arena.com.br" --papel proprietario
```

O login web fica em `http://localhost:5173/login` e usa cookie HttpOnly.

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
