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
- A retenção de Replays aceita uma quantidade positiva de dias ou a opção
  `Não remover automaticamente`, que será o padrão da v1, conforme ADR-021.
- O mesmo registro mantém os dados cadastrais da empresa: CNPJ, Nome, Nome
  Fantasia, CEP, Endereço, Cidade, Estado (UF) e Telefone. Eles poderão ser preenchidos
  gradualmente para uso fiscal futuro e ainda não disparam emissão de nota.
- O CNPJ é persistido sem pontuação e em maiúsculas. Para compatibilidade com o
  formato alfanumérico adotado em 2026, as primeiras 12 posições aceitam letras
  ou números e as duas posições finais permanecem dígitos verificadores. CNPJs
  exclusivamente numéricos continuam aceitos. O Telefone é persistido somente
  com dígitos e deve ter 10 ou 11 posições; a UF deve ter duas letras.
- O CEP é persistido com 8 dígitos. Sua consulta usa a API HTTPS do OpenCEP por
  meio do backend e apenas sugere Endereço, Cidade e UF; o Usuário pode revisar e
  complementar os dados antes de salvar.
- A tela apresenta o diretório local de mídia e permite solicitar sua troca. A
  mudança física depende do componente local de instalação e só se torna efetiva
  após validação e aplicação da montagem compartilhada pelos processos de vídeo.
- A tela lista, por meio do ARENAX Local Agent, as interfaces IPv4 ativas da
  máquina host. Proprietário ou Administrador escolhe a interface conectada à
  rede dos AX Devices; identificador, nome e endereço ficam persistidos em
  Configurações e compõem a URL de acionamento exibida no Health Center.
- Endereços de loopback, como `localhost` e `127.0.0.1`, e endereços link-local
  não podem ser usados para configurar AX Devices.
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
- Retenção e diretório de mídia pertencem à infraestrutura de Momentos / Replay.
- A seleção da base temporal é administrada por Configurações e interpretada pelo
  contexto Financeiro.
- Os Dados da Empresa pertencem à administração da Arena. O futuro contexto
  Fiscal os consumirá, sem transferir para Configurações as regras de emissão.
- O módulo de Configurações administra os valores, mas não assume as invariantes
  da Sessão nem o processamento do Replay.

## Consequências
- O frontend usa a duração padrão somente para preencher o período inicial.
- O backend continua protegendo período válido e conflitos entre Sessões.
- O Replay Worker recebe a janela no job e não consulta valores globais para
  reinterpretar um Momento existente.
- Variáveis de ambiente podem permanecer como contingência técnica durante a
  migração, mas deixam de ser a fonte funcional desses valores.
