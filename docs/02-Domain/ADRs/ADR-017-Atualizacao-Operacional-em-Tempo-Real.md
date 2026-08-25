# Atualização operacional em tempo real

## Status
Aceita.

## Contexto
O Mission Control deve refletir mudanças operacionais sem atualização manual.
Consultas periódicas atendiam parcialmente esse requisito, com atraso e requisições
mesmo quando nada mudava.

## Decisão
- A API oferece um fluxo autenticado de Server-Sent Events (SSE).
- O fluxo publica sinais de invalidação, não cópias do estado dos Agregados.
- Ao receber um sinal, o frontend consulta novamente a projeção REST correspondente.
- O polling permanece como contingência quando o canal em tempo real estiver desconectado.
- Eventos do domínio e o canal de entrega ao navegador são conceitos distintos.

## Consequências
O estado canônico e as regras permanecem no backend, o contrato REST continua
reutilizável e o Mission Control reduz sua defasagem operacional. A implementação
inicial pressupõe uma instância da API; a distribuição entre instâncias exigirá
um broker compartilhado sem alterar o contrato SSE.
