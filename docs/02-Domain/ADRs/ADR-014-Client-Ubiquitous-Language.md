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
- Cliente possui `Tipo`: `F` para Pessoa Física e `J` para Pessoa Jurídica.
- `Documento` identifica o Cliente conforme o Tipo. Pessoa Física usa CPF com 11
  dígitos; Pessoa Jurídica usa CNPJ, inclusive o formato alfanumérico de 2026 com
  12 letras ou números e 2 dígitos verificadores.
- Documento é opcional, mas, quando informado, deve ser único entre os Clientes.
- A máscara pertence à apresentação. CPF e CNPJ são persistidos sem pontuação e
  o CNPJ é normalizado em maiúsculas.
- O endereço do Cliente contém CEP, Endereço, Cidade e UF. O CEP é persistido com
  8 dígitos e a UF com duas letras maiúsculas.
- Cliente pode possuir Observações em texto livre e um indicador administrativo
  Ativo/Inativo, aplicável tanto na criação quanto na edição.
- Cliente pode possuir Telefone e E-mail. O Telefone é persistido somente com
  dígitos e pode ser marcado, por indicador booleano, como contato de WhatsApp.
- A busca autenticada pelo OpenCEP sugere Endereço, Cidade e UF; o Usuário pode
  revisar e complementar os valores antes de salvar.
- Clientes existentes recebem Tipo `F` e Documento vazio na migration, sem criação
  de um CPF fictício.
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
