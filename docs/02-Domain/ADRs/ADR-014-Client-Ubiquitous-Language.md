# Cliente na Linguagem Ubíqua

## Status
Aceita.

## Contexto
O cadastro operacional era chamado de Pessoa, embora no MVP represente quem é
atendido pela Arena e pode assumir a responsabilidade por uma Sessão. O termo era
genérico demais para análise do negócio e navegação administrativa.

## Decisão
- `Cliente` substitui `Pessoa` na linguagem ubíqua, domínio, API, código, banco e UX.
- Cliente é o cadastro de uma pessoa atendida pela Arena.
- Em uma Sessão, um Cliente exerce o papel de `Responsável`.
- Cliente e Usuário permanecem conceitos separados: Cliente participa da operação;
  Usuário possui credenciais de acesso à plataforma.
- Participantes detalhados continuam fora do MVP.
- Qualquer Usuário ativo pode criar, consultar, editar e excluir Clientes.
- Um Cliente vinculado como Responsável de qualquer Sessão não pode ser excluído,
  pois o histórico operacional deve ser preservado.
- A API canônica usa `/api/v1/clients`; `/api/v1/people` permanece temporariamente
  como alias depreciado para compatibilidade.
- A migration renomeia `pessoas` para `clientes` sem perda de dados. A coluna
  `sessoes.responsavel_id` mantém o nome porque representa o papel na Sessão.

## Consequências
Novas funcionalidades, documentação e contratos devem usar Cliente. O alias
depreciado será removido apenas em uma futura versão do contrato da API.
