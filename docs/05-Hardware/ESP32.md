# AX Device — ESP32

## MVP
ESP32 como base do AX Device.

## Responsabilidade
Conectar à rede; identificar-se; detectar botão; enviar evento HTTP; receber confirmação técnica; não executar regras de negócio.

## Não conhece
URL RTSP; Sessão; quantidade de câmeras; duração do Replay; armazenamento; compartilhamento.

```http
POST /api/v1/events/button-pressed
```

Ethernet é preferível quando viável; Wi-Fi é alternativa.
