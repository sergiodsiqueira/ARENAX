# AX Device desacoplado de câmeras

## Status
Aceita.

## Decisão
O ESP32 não conhece URLs de câmera nem decide o que gravar. O backend resolve Espaço, Sessão, câmeras e ação.
O `device_id` publicado pelo AX Device corresponde ao ID técnico único do
Equipamento. A Descrição amigável não participa da integração.

## Consequências
- Mantém a linguagem consistente.
- Reduz acoplamento.
- Deve orientar novas funcionalidades.
