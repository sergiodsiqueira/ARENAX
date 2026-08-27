# Configurações

## Objetivo
Permitir que Proprietário e Administrador ajustem padrões operacionais globais da
Arena. A primeira versão contém apenas configurações de Sessão e Replay.

## Acesso
- Localização: `Administração > Configurações`.
- Proprietário e Administrador podem consultar e salvar.
- Operador não acessa a tela nesta primeira versão.

## Estrutura da tela
A página usa o padrão visual administrativo da ARENAX, com título, descrição curta
e cards brancos sobre o fundo da aplicação.

### Card Sessões

Campo `Duração padrão de cada Sessão`, numérico, exibido em minutos.

- Valor inicial: `60` minutos.
- Deve ser maior que zero.
- É usado para preencher automaticamente o horário final ao criar uma Sessão.
- O operador ainda pode ajustar o início e o fim antes de salvar.

### Card Replays

Campos numéricos exibidos em segundos:

- `Duração anterior ao acionamento`: valor inicial `30` segundos.
- `Duração posterior ao acionamento`: valor inicial `5` segundos.

Os valores não podem ser negativos e a soma deve ser maior que zero. Um texto de
apoio informa a duração total resultante do Replay.

## Ações e feedback
- Uma única ação `Salvar configurações` persiste os dois grupos.
- O botão fica desabilitado enquanto os valores forem inválidos ou durante o envio.
- Sucesso e falha usam Toast/Sonner conforme o Design System.
- Erros de validação também aparecem junto ao respectivo campo.
- Ao sair com alterações não salvas, a interface solicita confirmação.

## Comportamento
- A tela carrega os valores persistidos; não mantém cópia própria como fonte de
  verdade.
- Alterações valem para novas Sessões e novos pedidos de Replay.
- Sessões existentes, Momentos já solicitados e Replays gerados não são alterados.
