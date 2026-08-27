# Frontend

## Stack
React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, React Router e tempo real via WebSocket/SSE após validação técnica.

## Superfícies operacionais
1. Mission Control — o que acontece agora?
2. Agenda — o que vai acontecer?
3. Sessão — qual é o dossiê desta utilização?

O painel de Espaços do Mission Control permite filtrar os cards pelo estado
operacional derivado da Sessão e pelo estado de indisponibilidade administrativa.

## Administração
Clientes, Espaços, Equipamentos, Arena Designer, Configurações, Relatórios e Health Center.

### Configurações

A primeira versão fica em `Administração > Configurações` e permite ajustar a
duração padrão de uma Sessão e as durações anterior e posterior ao acionamento que
formam a janela do Replay. A especificação da tela está em
`docs/04-UX/Settings.md`.

### Padrão das telas de cadastro

- Cabeçalho com a ação `Cadastrar` no canto superior direito.
- Três totalizadores clicáveis, nesta ordem: Ativos, Inativos e Todos.
- Os totalizadores usam identidade visual semântica: Ativos em verde com check,
  Inativos em vermelho com X e Todos em azul com double check. O ícone branco
  fica dentro de um círculo em tom mais escuro que o fundo do card.
- Listagem em grid com as colunas Tipo, Descrição e Ações.
- Tipo apresenta o ícone do elemento; Ações apresenta Editar e Excluir.
- Cadastro e edição compartilham o mesmo modal, encerrado pelas ações Salvar e Cancelar.
- Novos registros são ativos por padrão; a mudança de estado é feita na edição.

O frontend apresenta estado e envia intenções; regras permanecem no backend/domínio.
