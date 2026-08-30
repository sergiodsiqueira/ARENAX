# Health Center

## Objetivo

Responder se a infraestrutura necessária para operar a Arena está disponível e
traduzir falhas técnicas para o Espaço afetado. É uma projeção operacional de
infraestrutura; não pertence ao Aggregate Root Sessão e não contém regras de negócio.

## Primeira entrega

- Situação consolidada: saudável, atenção ou crítica.
- API, PostgreSQL e MediaMTX verificados no momento da consulta.
- Capture Service e Replay Worker acompanhados por heartbeat com validade temporal.
- Capacidade livre do armazenamento de mídia.
- Saúde de cada Câmera, identificada pelo Espaço ao qual pertence.
- Atualização automática a cada 15 segundos e atualização manual opcional.
- Acesso disponível a todo Usuário autenticado, incluindo Operador.

## Semântica

- `healthy`: verificação recente e bem-sucedida.
- `degraded`: disponível, mas próximo de um limite operacional.
- `unavailable`: falha presente ou heartbeat expirado.
- `unknown`: nenhum sinal recebido ainda.
- `inactive`: Equipamento administrativamente inativo; não afeta o estado consolidado.

Qualquer item indisponível torna o estado geral crítico. Itens degradados ou sem
primeiro sinal tornam o estado geral atenção. Câmeras inativas não representam falha.

## Limites atuais

AX Devices ainda não aparecem porque não existe contrato de heartbeat ou último
contato confiável. A primeira entrega também não mantém histórico, incidentes ou
notificações; apresenta somente o estado atual.
