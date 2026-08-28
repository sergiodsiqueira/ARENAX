# Configurações operacionais da Arena

## Status
Aceita.

## Contexto
A duração inicialmente sugerida para uma Sessão e a janela de vídeo de um Replay
precisam ser administráveis sem alterar código ou variáveis de ambiente. Esses
valores são globais para a única Arena atendida pelo MVP.

## Decisão
- O MVP mantém um único registro de configurações operacionais na tabela
  `configuracoes`.
- A duração padrão da Sessão é armazenada em minutos e começa com `60`.
- A duração anterior ao acionamento do Replay é armazenada em segundos e começa
  com `30`.
- A duração posterior ao acionamento do Replay é armazenada em segundos e começa
  com `5`.
- `calcular_tempo_real` define a base temporal do cálculo financeiro automático e
  começa como `true`. Quando ativo, usa o período real da Sessão; quando inativo,
  usa o período previsto, conforme ADR-020.
- A duração padrão da Sessão é uma sugestão para a criação. A Sessão continua
  persistindo `inicio_previsto` e `fim_previsto`, e o operador pode ajustar o
  período antes de salvar.
- Ao criar um Momento, a aplicação copia as durações anterior e posterior vigentes
  para os dados imutáveis de `ReplayRequested`. Alterar Configurações não modifica
  Replays já solicitados ou gerados.
- Somente Proprietário e Administrador podem consultar ou alterar Configurações
  nesta primeira versão.
- A duração da Sessão deve ser positiva. As duas parcelas do Replay não podem ser
  negativas e sua soma deve ser maior que zero.

## Responsabilidades
- A configuração de duração da Sessão pertence ao contexto de Operação.
- A janela de Replay pertence ao contexto de Momentos / Replay.
- A seleção da base temporal é administrada por Configurações e interpretada pelo
  contexto Financeiro.
- O módulo de Configurações administra os valores, mas não assume as invariantes
  da Sessão nem o processamento do Replay.

## Consequências
- O frontend usa a duração padrão somente para preencher o período inicial.
- O backend continua protegendo período válido e conflitos entre Sessões.
- O Replay Worker recebe a janela no job e não consulta valores globais para
  reinterpretar um Momento existente.
- Variáveis de ambiente podem permanecer como contingência técnica durante a
  migração, mas deixam de ser a fonte funcional desses valores.
