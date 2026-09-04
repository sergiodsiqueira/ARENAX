# Armazenamento e acesso local aos Replays na v1

## Status

Aceita.

## Contexto

A v1 da ARENAX será instalada na máquina local do cliente. O Compartilhamento de
Replays é a última entrega funcional do MVP e precisa respeitar esse limite de
implantação sem introduzir exposição pública ou dependência de nuvem.

## Decisões

- A aplicação e os Replays serão acessados somente na rede local da Arena.
- A v1 não disponibilizará link público, anônimo ou acessível pela internet.
- O acesso ao Replay continuará exigindo um Usuário autenticado da ARENAX.
- Os vídeos serão armazenados em pasta local escolhida por Proprietário ou
  Administrador na tela de Configurações.
- Configurações permitirá informar a quantidade de dias de retenção ou marcar
  `Não remover automaticamente`. As opções são mutuamente exclusivas.
- `Não remover automaticamente` será o padrão da v1. A remoção automática só será
  ativada por intenção explícita de Proprietário ou Administrador ao informar uma
  quantidade positiva de dias.
- O Dossiê manterá a ação `Baixar` e acrescentará `Compartilhar` no mesmo menu.
- `Compartilhar` usará o seletor nativo do sistema quando o navegador aceitar o
  arquivo de vídeo. O WhatsApp poderá ser escolhido quando estiver disponível como
  destino no sistema operacional.
- Quando o compartilhamento nativo não estiver disponível, a aplicação baixará o
  vídeo e poderá abrir o WhatsApp com uma mensagem preenchida; o Usuário anexará o
  arquivo manualmente.
- Não haverá página pública ou página específica para Cliente na v1.
- A ação explícita de Compartilhar será auditada na Timeline da Sessão com Usuário,
  instante, Momento e Replay. Reprodução e download não provam compartilhamento.
- Armazenamento em nuvem e modelo híbrido ficam fora da v1.

## Restrição de infraestrutura

API, Capture Service e Replay Worker executam em containers e precisam enxergar o
mesmo diretório de mídia. O instalador define a montagem inicial e instala o
`ARENAX Local Agent` no Windows, fora do Docker e iniciado no login do usuário.
Na troca posterior, Configurações solicita ao agente que abra o seletor nativo de
pastas. Após confirmação do Administrador, o agente valida a escrita, pausa os
processos de vídeo, copia a mídia, atualiza a montagem e recria os componentes.

O agente aceita somente operações predefinidas e exige um segredo aleatório
compartilhado com a API. O navegador não recebe acesso ao host, ao segredo ou ao
socket do Docker. A pasta anterior não é removida automaticamente e o arquivo de
ambiente é restaurado se a nova montagem não puder ser iniciada. O script
`configure-storage.ps1` permanece apenas como contingência para suporte técnico.

O compartilhamento nativo do navegador exige contexto seguro. `localhost` é
tratado de forma especial, mas acesso por endereço IP na rede local pode exigir
HTTPS local para disponibilizar essa capacidade.

## Decisões ainda pendentes

- Estratégia de certificado/HTTPS para dispositivos que acessarem por IP na rede.

## Consequências

- Não haverá infraestrutura pública de entrega, CDN ou storage externo na v1.
- O Compartilhamento será uma capacidade local e autenticada do contexto de
  Momentos / Replay.
- A remoção física de um arquivo não deve apagar o Momento nem a Timeline da
  Sessão; o dossiê histórico precisa continuar íntegro.
- A aplicação não pode afirmar qual destino foi escolhido no seletor nativo nem
  confirmar que o arquivo foi entregue pelo WhatsApp.
- A janela de seleção é exibida na máquina host; por isso o agente roda na sessão
  interativa do Windows, e não como serviço isolado na sessão 0.
