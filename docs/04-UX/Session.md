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

## Entrega de Replay na v1

Cada Replay pronto mantém `Baixar` e oferece `Compartilhar` no mesmo menu. A ação
Compartilhar tenta enviar o arquivo ao seletor nativo do sistema, no qual o Usuário
pode escolher WhatsApp quando disponível. Se o navegador não aceitar arquivos no
compartilhamento nativo, a ARENAX baixa o vídeo e abre o WhatsApp com uma mensagem
preenchida; o anexo é manual.

Não há página pública ou acesso de Cliente. A Timeline registra a intenção explícita
de Compartilhar, mas não afirma qual aplicativo recebeu o arquivo nem confirma sua
entrega ao destinatário.
