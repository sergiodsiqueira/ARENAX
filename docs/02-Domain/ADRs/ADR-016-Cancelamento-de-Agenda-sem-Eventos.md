# Cancelamento de Agenda sem eventos associados

## Status

Aceita.

## Contexto

Uma Sessão recém-agendada possui apenas o evento técnico `SessionCreated`. Manter
como cancelada uma agenda que nunca recebeu atividade operacional gera registros
sem valor histórico para a operação.

## Decisão

- A ação de cancelar exclui definitivamente a Sessão quando sua Timeline contém
  somente `SessionCreated` e não existe Momento associado.
- Qualquer evento posterior à criação ou qualquer Momento torna a Sessão
  historicamente relevante; nesse caso, cancelar realiza a transição normal para
  `cancelled` e registra `SessionCancelled`.
- A decisão é tomada no backend, dentro do caso de uso de Sessão, e vale para
  qualquer interface que envie o comando de cancelamento.
- A interface deve avisar que uma agenda sem eventos associados será excluída.

## Consequências

Agendas intocadas deixam de ocupar a Agenda após o cancelamento. Sessões com
evidência operacional continuam preservadas no dossiê e na Timeline.
