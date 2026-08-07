# Arquitetura Geral

## Estilo
DDD como orientação de modelagem; Clean Architecture/Ports & Adapters para dependências; monólito modular; API First; eventos internos; workers para vídeo.

```text
React / TypeScript
        |
 REST + tempo real
        |
FastAPI - Application Layer
        |
   Domain Layer
        |
Infrastructure
 |       |       |
Postgres Redis  FFmpeg/Storage
```

## Runtime
Web App; API FastAPI; PostgreSQL; Redis; Capture Service; Replay Worker; AX Devices; Câmeras IP.

## Repositório
```text
arenax-platform/
  apps/api/
  apps/web/
  services/replay-worker/
  services/capture-service/
  firmware/esp32/
  packages/contracts/
  packages/shared/
  docs/
  docker/
  scripts/
```
