# API First

## Recursos
```text
/api/v1/arenas
/api/v1/spaces
/api/v1/sessions
/api/v1/people
/api/v1/equipments
/api/v1/moments
/api/v1/replays
/api/v1/payments
/api/v1/events
/api/v1/health
```

## AX Device
```http
POST /api/v1/events/button-pressed
```
```json
{"deviceId":"AX-001","timestamp":"2026-08-07T21:00:00Z"}
```
O dispositivo não informa câmera, Sessão ou Replay.

Códigos amigáveis (`SES-...`, `SP-...`, `AX-...`) podem coexistir com chaves técnicas internas.
