# Ciclo de vida e modelo temporal da Sessão

## Status
Aceita.

## Contexto
Os estados da Sessão e a regra de não sobreposição estavam enumerados, mas não
possuíam transições nem semântica temporal suficientes para implementação.

## Decisão
- O MVP cria a Sessão em `Agendada`.
- Transições: `Agendada -> Confirmada|Cancelada|Não compareceu`;
  `Confirmada -> Em andamento|Cancelada|Não compareceu`; `Em andamento ->
  Finalizada|Cancelada`; `Finalizada -> Arquivada`.
- Início direto de `Agendada` é permitido para não bloquear a operação presencial.
- Intervalos previstos são semiabertos: `[início, fim)`. Portanto, uma Sessão pode
  começar exatamente quando outra termina.
- Instantes são recebidos e persistidos em UTC. A apresentação usa o fuso da Arena.
- Criar, alterar período, iniciar e prorrogar devem proteger atomicamente a ausência
  de conflito para todos os Espaços envolvidos.
- Canceladas, Finalizadas, Arquivadas e Não compareceu não bloqueiam disponibilidade
  futura. Sessões Agendadas, Confirmadas e Em andamento bloqueiam seus intervalos.

## Consequências
A regra é aplicada no domínio e reforçada transacionalmente na persistência. O MVP
usa lock transacional por Espaço antes de consultar conflitos; uma futura exclusion
constraint poderá substituir ou complementar essa estratégia.

