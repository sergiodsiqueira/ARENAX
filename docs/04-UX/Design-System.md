# Design System

## Direção
Light Premium padrão; Inter; espaço em branco; cards claros; bordas discretas; cores fortes somente para estado/ação.

As telas Stravix fornecidas pelo Product Owner são a referência visual oficial,
principalmente para paleta, densidade, navegação e hierarquia. Não copiar o
conteúdo ou a marca; traduzir o sistema visual para o domínio ARENAX.

## Paleta de referência
- Verde-petróleo `#285F55`: ação primária, navegação ativa e números de destaque.
- Menta `#78E3B0`: destaque positivo, seleção e acento operacional.
- Verde pálido `#DFF1E7`: fundos informativos, filtros e estados suaves.
- Fundo da aplicação `#F6F6F6` e superfícies `#FFFFFF`.
- Texto principal `#262626`; texto secundário `#7B7F7D`.
- Bordas `#E6EBE8`, finas e discretas.
- Âmbar e vermelho ficam reservados para atenção, atraso, falha e ação destrutiva.

## Composição
- Sidebar branca, item ativo em cápsula verde-petróleo e ícones lineares.
- Fundo cinza muito claro com cards brancos de raio moderado e sombra mínima.
- Cabeçalhos limpos, controles em cápsula e tabelas com bastante respiro.
- Verde pálido organiza grupos; verde forte comunica ação ou seleção.
- Evitar grandes superfícies escuras, gradientes decorativos excessivos e bordas pesadas.

## Implementação
shadcn/ui é a fundação de componentes. Cores devem vir dos tokens semânticos
em `apps/web/src/styles.css`; não introduzir hexadecimais isolados nas páginas.

As superfícies usam `background`, `card`, `muted` e `secondary`; textos usam
`foreground`, `muted-foreground` e `primary`. Alertas usam os tokens `warning`
e `destructive`, com fundos e bordas próprios. O preto é reservado à mídia.

### Tipografia, botões e cabeçalhos

A herança de fonte dos campos fica na camada base para permitir os tamanhos
e pesos dos componentes. Button e os botões operacionais compartilham a base
visual: altura padrão de 36 px, texto de 14 px, peso médio, raio moderado,
hover sem deslocamento, foco visível e cursor de indisponível quando desabilitados.

As páginas internas usam `page-shell`: largura máxima de 1280 px, margem vertical
de 32 px e espaçamento horizontal de 20 px (32 px em telas maiores). Os títulos
usam `page-heading`, com 30 px, peso semibold e tracking compacto. Ações do
cabeçalho ficam empilhadas em telas pequenas. O Login mantém sua hierarquia própria.

### Cards de Sessão

Horários ficam em bloco verde pálido com texto verde-petróleo. Nome e Espaços
admitem quebra de linha; contato e duração usam texto legível de 14 px. Ações
ficam abaixo das informações, separadas por uma borda discreta, com quebra de
linha conforme a largura disponível.

### Modais de formulário

FormModal usa Dialog do Radix, base do shadcn, com foco contido no modal,
retorno do foco ao controle de origem e fechamento por Escape ou controle explícito.
Clique fora não descarta o formulário. Todos têm margem mínima de 16 px na tela,
altura máxima baseada na viewport e rolagem interna. Formulários usam padding
de 24 px; larguras variam conforme o conteúdo. Modais sobrepostos mantêm o foco
e o fechamento na camada superior.

## Feedback de interação
Todo elemento acionável deve comunicar que aceita interação. Botões, links,
seletores, checkboxes, radios, rótulos associados e elementos com `role="button"`
usam cursor de ponteiro. Controles desabilitados usam cursor `not-allowed` e estado
visual atenuado. Preservar também feedback de hover e foco visível por teclado.

## Estados
Disponível: neutro; Em Sessão: verde; Encerrando: âmbar; Excedido: vermelho; Offline: estado de infraestrutura.

## Escala
4, 8, 12, 16, 24, 32 e 48.

## Componentes
Space Node, Session Drawer, Arena Pulse, Status Badge, KPI Card, Timeline Item, Action Center Item e Health Indicator.

### KPI/Status Counter Card
Card horizontal compacto conforme a referência: ícone existente à esquerda em
bloco arredondado, rótulo pequeno e valor em verde-petróleo. O selecionado usa
fundo verde pálido e bloco do ícone branco; os demais usam fundo cinza claro e
bloco do ícone verde pálido. Não atribuir uma cor diferente a cada contador.

### DatePicker
Calendário compacto em card claro, com sete colunas, dias externos atenuados e
seleção circular menta. Datas que possuem Sessões recebem um pequeno indicador
menta sob o número. Controles de troca de mês são discretos, mas mantêm cursor,
hover e foco visível. Usar nomes de dias e meses em `pt-BR`.

Na Agenda, o calendário fica sempre expandido no card, com cabeçalho somente
de mês e ano (ex.: “Setembro 2026”) e setas para navegar entre meses.
O botão Hoje e o filtro de Espaço ficam abaixo dos dias.
O título de mês e ano abre a seleção dos meses. Clicar no ano desse seletor
exibe uma grade de anos, com navegação por grupos, para consultar períodos antigos.

No formulário de criação de Sessão, usar a variante de período: calendário e
horários inicial/final no mesmo card, separados por uma borda discreta. A data
inicial é a data atualmente exibida na Agenda; os valores são compostos como
instantes e enviados ao backend, que permanece responsável pelas invariantes.

### Combobox
Campos de seleção de uma opção usam o Combobox do shadcn, com busca textual,
navegação por teclado, indicação da opção ativa e estado vazio. Não usar o
elemento HTML `select` nas telas da aplicação. Checkboxes continuam reservados
a escolhas booleanas ou seleção de linhas e não devem ser substituídos por
Combobox.

O filtro de Espaço da Agenda usa Combobox do shadcn, com a opção Todos e os
Espaços disponíveis, logo abaixo do botão Hoje no card do calendário.
Usar somente o rótulo principal “Espaço”, sem descrição auxiliar.
Em telas grandes, o card ocupa 30% da largura disponível e preenche a altura
do conteúdo abaixo do cabeçalho, até a margem inferior da página.

Os cards de Sessão da Agenda ficam em um contêiner claro que preenche a mesma
altura disponível do calendário em telas grandes. A lista tem rolagem interna
quando necessário, mantendo o cabeçalho e o calendário acessíveis. Em telas
menores, os contêineres ficam empilhados e a lista tem altura máxima de 70dvh.

### Input
Campos de texto, e-mail, senha, número e data usam o Input do shadcn, mantendo
os tokens semânticos de borda, foco, fundo e estado desabilitado. Não criar
estilos locais que dupliquem a aparência do componente. Checkboxes permanecem
como controles booleanos e usam seu componente específico.

### Checkbox
Escolhas booleanas e seleção múltipla usam o Checkbox do shadcn, com estado
marcado na cor primária, foco visível e rótulo associado. Não usar o elemento
HTML `input[type="checkbox"]` diretamente nas telas da aplicação.

### Toast
Notificações transitórias de sucesso e erro usam o Sonner do shadcn, exibido
no canto superior direito, com fechamento manual e cores semânticas. Não manter
faixas de feedback dentro do layout após salvar, atualizar ou excluir. Erros
estruturais de carregamento e validação junto ao campo permanecem inline.

### Alert Dialog
Confirmações de ações destrutivas ou irreversíveis usam o Alert Dialog do
shadcn. O título nomeia a intenção, a descrição explica a consequência e o botão
destrutivo repete a ação concreta. Não usar `window.confirm` ou
`globalThis.confirm`.

## Figma
1. `00 — Foundations`
2. `01 — Components`
3. `02 — Product Screens`
