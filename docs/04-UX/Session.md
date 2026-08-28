# Experiência da Sessão

## Resumo
Código, status, Responsável, Espaços, horário previsto/real, tempo restante, Pagamento, Momentos/Replays e Ocorrências.

## Timeline
```text
19:00 Sessão iniciada
19:12 Pagamento registrado
19:24 Momento solicitado
19:25 Replay gerado
19:26 Replay compartilhado
19:58 Sessão prorrogada
20:30 Sessão finalizada
```

No Mission Control, detalhes rápidos podem abrir em Session Drawer sem perder contexto.

## Pagamentos no MVP
O operador pode registrar valor, método e observação. Cada registro
exibe valor, método e instante e não possui edição ou exclusão no MVP.

Com valor por minuto configurado nos Espaços, o Dossiê apresenta valor previsto,
total pago e saldo. O campo de novo Pagamento inicia com o saldo calculado pelo
backend, mas continua editável para permitir recebimentos parciais.

Ao lado dos valores, a ação com lápis abre um modal para substituir o valor
previsto da Sessão. A ação de atualizar recalcula usando os valores por minuto
históricos fotografados na Sessão. As ações ficam separadas visualmente e fornecem feedback por
toast.
