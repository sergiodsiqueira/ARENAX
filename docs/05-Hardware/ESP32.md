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

Em Configurações, o Administrador seleciona uma interface IPv4 ativa detectada
pelo ARENAX Local Agent. A API persiste a seleção e monta a URL completa exibida
no Health Center. `localhost`, loopback e endereços locais automáticos não são
aceitos, pois no AX Device apontariam para o próprio dispositivo.

Ethernet é preferível quando viável; Wi-Fi é alternativa.
