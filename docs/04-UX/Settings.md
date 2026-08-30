# Configurações

## Objetivo
Permitir que Proprietário e Administrador ajustem padrões operacionais globais da
Arena. A primeira versão contém configurações de Sessão, Replay, armazenamento
local e dados cadastrais da empresa.

O Proprietário ou Administrador altera o armazenamento por `Escolher outra pasta`.
O Agente Local abre o seletor do Windows na máquina da ARENAX. A interface mostra
o caminho escolhido e exige confirmação, explicando a breve pausa dos processos
de vídeo e a cópia dos arquivos. Não se exibe comando ou instrução de terminal.

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

### Card Dados da Empresa

- Este é o primeiro card da página.
- Campos: `CNPJ`, `Nome`, `Nome Fantasia`, `CEP`, `Endereço`, `Cidade`, `Estado
  (UF)` e `Telefone`.
- CNPJ e telefone recebem máscara visual. O CNPJ aceita letras e números nas 12
  primeiras posições e dígitos nas duas finais; é enviado sem pontuação e em
  maiúsculas. O telefone é enviado apenas com dígitos.
- O telefone aceita 10 dígitos para linha fixa ou 11 para celular.
- O campo é rotulado `UF`, aceita duas letras e é convertido para maiúsculas.
- `Buscar CEP` consulta o OpenCEP e preenche Endereço, Cidade e UF. Os campos
  permanecem editáveis para número, complemento e eventuais correções.
- Os campos podem ser preenchidos gradualmente. Sua presença não significa que a
  emissão de notas fiscais já esteja habilitada.

### Card Armazenamento

- Exibe o diretório local de mídia atualmente aplicado.
- `Alterar local` copia o comando seguro com a pasta informada; o Usuário o executa
  na máquina da ARENAX para concluir a alteração.
- Antes de aplicar, informa que os processos de vídeo serão reiniciados e que jobs
  em andamento precisam terminar.
- A troca só é confirmada após validar escrita, espaço disponível e montagem
  compartilhada. Digitar um caminho na página, isoladamente, não altera o Docker.
- A retenção permite informar uma quantidade positiva de dias ou marcar
  `Não remover automaticamente`. O checkbox inicia marcado e desabilita o campo
  de dias. A limpeza automática só começa após uma alteração explícita e salva.

## Ações e feedback
- Uma única ação `Salvar configurações` persiste todos os grupos.
- O botão fica desabilitado enquanto os valores forem inválidos ou durante o envio.
- Sucesso e falha usam Toast/Sonner conforme o Design System.
- Erros de validação também aparecem junto ao respectivo campo.
- Ao sair com alterações não salvas, a interface solicita confirmação.

## Comportamento
- A tela carrega os valores persistidos; não mantém cópia própria como fonte de
  verdade.
- Alterações valem para novas Sessões e novos pedidos de Replay.
- Sessões existentes, Momentos já solicitados e Replays gerados não são alterados.
