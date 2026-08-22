# Checkpoint de Desenvolvimento — 2026-08-20

## Estado atual

Branch: `feature/mvp`. As alterações descritas abaixo estão no workspace e ainda
não foram commitadas.

## Entregas concluídas

- Autenticação por cookie HttpOnly e papéis proprietário, administrador e operador.
- Administração de Usuários: cadastro, papel, estado, redefinição de senha e
  revogação de Acessos.
- Mission Control responsivo com Espaços, Sessões, cronômetros e ações operacionais.
- Menu lateral responsivo dividido em Operação, Cadastros e Administração.
- Mudança oficial da linguagem ubíqua de Pessoa para Cliente, registrada na
  ADR-014.
- Migration `0004`: tabela `pessoas` renomeada para `clientes`, com dados e foreign
  keys preservados.
- API canônica de Clientes em `/api/v1/clients`; `/api/v1/people` permanece como
  alias depreciado.
- CRUD completo de Clientes disponível para qualquer Usuário ativo. Exclusão é
  bloqueada quando o Cliente é Responsável por alguma Sessão.
- Telas de Clientes, Espaços e Equipamentos padronizadas com totalizadores de
  Ativos, Inativos e Todos, grid de Tipo/Descrição/Ações e modal compartilhado
  entre cadastro e edição.
- Clientes e Equipamentos possuem estado administrativo `active` ou `inactive`;
  novos registros são ativos por padrão.
- CRUD de Espaços: consulta para todos; criação, edição e exclusão para proprietário
  e administrador. Exclusão é bloqueada quando há Sessão ou Equipamento vinculado.
- Estados administrativos de Espaço: `active`, `maintenance` e `disabled`.
- Novas Sessões aceitam somente Espaços `active`; a Agenda oculta Espaços em
  manutenção ou desativados e o backend protege a mesma invariável.
- API de Equipamentos com cadastro, consulta, edição e exclusão controlada.
  Câmeras exigem URL de captura; AX Devices com eventos físicos registrados não
  podem ser excluídos, preservando o histórico operacional.
- Administração de Equipamentos com filtro por Espaço, cadastro, edição e exclusão
  de Câmeras e AX Devices.
- Exclusão definitiva permitida para qualquer Equipamento após confirmação
  explícita; remove o vínculo administrativo e, para Câmeras, também remove o canal
  dinâmico do gateway. A auditoria pertencente à Sessão permanece preservada.
- Visualização ao vivo de Câmeras em modal a partir do card do Equipamento. A API
  registra sob demanda a mesma fonte RTSP no MediaMTX e retorna um canal WebRTC
  opaco, sem expor credenciais da Câmera ao frontend.
- Agenda diária com criação de Sessões para um Cliente Responsável e múltiplos
  Espaços, navegação por data e ações de confirmar, iniciar, cancelar e registrar
  não comparecimento.
- Ao cancelar, uma agenda que possui apenas `SessionCreated` e nenhum Momento é
  excluída; Sessões com eventos associados permanecem preservadas como canceladas,
  conforme ADR-016.
- Dossiê da Sessão acessível pela Agenda e Mission Control, com resumo operacional,
  período previsto/real, Timeline, Momentos e galeria de Replays com atualização
  durante o processamento.

## Navegação atual

- Operação
  - Mission Control
  - Agenda
- Cadastros
  - Clientes
  - Espaços
- Administração
  - Equipamentos
  - Acessos

## Validação mais recente

- API: 43 testes aprovados no Docker.
- Frontend: ESLint aprovado.
- Frontend: build de produção aprovado.
- Migration atual do banco: `0005`.
- API em execução e saudável em `http://localhost:8000`.
- Frontend local em `http://localhost:5173`.

## Decisões importantes

- Tudo acontece em um Espaço durante uma Sessão.
- Sessão continua sendo o Aggregate Root principal.
- Cliente e Usuário são conceitos separados.
- Responsável é o papel exercido por um Cliente na Sessão.
- Regras de negócio e autorização permanecem no backend.
- Exclusões não podem destruir histórico operacional.

## Próximos passos sugeridos

1. Substituir atualizações periódicas do Mission Control por eventos em tempo real.

## Retomada

Ao continuar, ler este arquivo, `AGENTS.md`, `docs/README.md` e os ADRs relevantes.
Antes de novas alterações, executar `git status --short` para preservar o trabalho
local ainda não commitado.
