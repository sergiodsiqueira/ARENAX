# Jobs confiáveis de Replay

## Status
Aceita.

## Decisão
O aceite do acionamento físico e a criação do Momento ocorrem na mesma transação.
Um registro de outbox `ReplayRequested` é persistido junto com o Momento. A entrega
é pelo menos uma vez; consumidores são idempotentes pela identidade do Momento.
Falhas permanecem observáveis e podem ser reenfileiradas.

Acionamentos repetidos com a mesma chave de idempotência retornam o resultado já
registrado. Sem Sessão ativa, o fato físico é auditado, mas Momento e Replay não são
criados.

## Consequências
Não há dual-write entre PostgreSQL e fila. Redis pode transportar jobs, mas não é a
fonte de verdade. O MVP inclui um publicador de outbox e um worker independente.

