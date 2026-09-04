# Bounded Contexts

## Operação
Sessões, Agenda, Mission Control, Timeline e alertas.

## Infraestrutura da Arena
Arena, Espaços, Equipamentos, Câmeras, AX Devices, capacidades e Arena Designer.

## Momentos / Replay
Solicitação de Momento, captura de buffer, FFmpeg, Replay, biblioteca e compartilhamentos.

## Financeiro
No MVP, pagamentos manuais associados à Sessão.

## Clientes
Cadastro e consulta de Clientes/Responsáveis.

## Configurações
Administra os valores operacionais globais da Arena. Cada valor continua sendo
interpretado pelo contexto proprietário da regra: duração padrão pela Operação e
janela de vídeo por Momentos / Replay.

> Bounded Context não implica microsserviço. O MVP será um **monólito modular**.
