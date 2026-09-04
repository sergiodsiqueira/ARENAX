# ARENAX — Foundation

Documentação-base consolidada para uso no Codex.

> **Regra central:** Na ARENAX, tudo acontece em um Espaço durante uma Sessão.

## Produto
A ARENAX é uma plataforma operacional para arenas esportivas. O MVP atende inicialmente um único estabelecimento, com Sessões criadas pelo operador a partir de solicitações por telefone ou WhatsApp.

## Estrutura
- `01-Product/`: visão, missão, manifesto e roadmap.
- `02-Domain/`: Domain Book, linguagem, agregados, contexts, Event Storming e ADRs.
- `03-Architecture/`: arquitetura, backend, frontend e contratos.
  O esquema físico em português está em `03-Architecture/Database-Schema.md`.
- `04-UX/`: Mission Control, Arena Designer, Sessão, Configurações e Design System.
- `05-Hardware/`: ESP32/AX Device e Replay.
- `06-Planning/`: Sprint 0, Sprint 1 e backlog.

## Princípios
1. A Sessão é o centro do domínio.
2. Espaço é qualquer recurso físico reservável da Arena.
3. Mission Control, Agenda e Sessão concentram a operação diária.
4. Hardware publica eventos físicos; regras ficam no backend.
5. Replay é conteúdo de um Momento da Sessão.
6. O domínio independe de UI, banco e hardware.
7. O MVP começa como monólito modular, com vídeo processado de forma assíncrona.
