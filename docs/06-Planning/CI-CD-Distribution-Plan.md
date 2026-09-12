# Plano de CI/CD e Distribuição Windows

## Estado

- Situação: implementação inicial concluída; aguardando tag de homologação e teste em máquina limpa.
- Início previsto: 2026-09-04.
- Objetivo: produzir versões instaláveis e rastreáveis da ARENAX por meio do GitHub.

## Direção escolhida para o MVP

Adotar GitHub Actions, GitHub Container Registry (GHCR), empacotamento offline de
imagens Docker em `.tar` e Inno Setup. O instalador tera WSL2 e Docker Desktop, ou
um Docker Engine compativel com Compose, como pre-requisitos. Os servicos serao
publicados como imagens versionadas, empacotados no instalador e carregados na
maquina da Arena sem compilar codigo e sem depender de internet no cliente.

### Versionamento e nomes oficiais

- releases usam tags SemVer no formato `vX.Y.Z`;
- `ghcr.io/sergiodsiqueira/arenax-api:<versão>`;
- `ghcr.io/sergiodsiqueira/arenax-web:<versão>`;
- `ghcr.io/sergiodsiqueira/arenax-capture-service:<versão>`;
- `ghcr.io/sergiodsiqueira/arenax-replay-worker:<versão>`.

Cada imagem também recebe uma tag imutável `sha-<commit>`. O Compose instalado usa
sempre a versão da release e não depende de `latest`.

Artefatos esperados em cada GitHub Release:

- `ArenaX-Setup-<versão>.exe`;
- checksum SHA-256 do instalador;
- notas da versão;
- imagens versionadas da API, frontend, Capture Service e Replay Worker no GHCR;
- imagens Docker de runtime empacotadas dentro do instalador para uso offline,
  incluindo PostgreSQL e MediaMTX.

## Fluxo planejado

### Integração contínua

Em pull requests e commits relevantes:

1. Executar testes da API, Capture Service e Replay Worker.
2. Executar lint e build de produção do frontend.
3. Validar os Dockerfiles e o Docker Compose de produção.
4. Executar verificações de segurança e registrar os resultados.

### Entrega contínua

Ao publicar uma tag no formato `vX.Y.Z`:

1. Construir e versionar as imagens Docker.
2. Publicar as imagens no GHCR.
3. Exportar as imagens de runtime em arquivos `.tar`.
4. Montar o pacote de implantacao para Windows com scripts, Compose e imagens.
5. Gerar o instalador com Inno Setup.
6. Calcular o checksum SHA-256.
7. Criar uma GitHub Release e anexar os artefatos para download.

## Trabalho necessário

1. Criar o Dockerfile de produção do frontend e servi-lo por um servidor web de
   produção.
2. Criar `docker-compose.production.yml`, consumindo imagens versionadas do GHCR.
3. Tornar o Agente Local independente da cópia do repositório.
4. Criar scripts idempotentes de instalação, atualização e desinstalação.
5. Preservar banco, configurações e Replays em atualizações e desinstalações.
6. Gerar segredos individualmente em cada instalação, sem incorporá-los às imagens.
7. Executar migrations com backup e estratégia de recuperação.
8. Definir o onboarding para criação do primeiro Proprietário.
9. Criar workflows de CI, publicação de imagens e GitHub Release.
10. Criar e, antes da distribuição comercial, assinar digitalmente o instalador.
11. Validar pre-requisitos WSL2/Docker antes de instalar.
12. Gerar guia HTML para o time de TI do cliente.

## Restrições operacionais

- Nunca atualizar durante uma Sessão em andamento.
- Nunca usar somente a tag `latest`; toda implantação deve fixar uma versão.
- Atualizações não podem apagar PostgreSQL, configurações ou arquivos de mídia.
- Senhas e segredos não podem ser armazenados no repositório ou nas imagens.
- A desinstalação deve pedir confirmação separada antes de remover dados da Arena.
- O enquadramento de licenciamento do Docker Desktop deve ser confirmado antes da
  distribuição comercial.
- A instalacao por pendrive deve funcionar sem internet quando WSL2 e Docker ja
  estiverem instalados e o daemon estiver em execucao.
- Instalacoes novas pedem o primeiro Proprietario no instalador; atualizacoes nao
  recriam usuarios e nao alteram dados existentes.

## Primeira etapa da retomada

1. Definir versionamento e nomes oficiais das imagens.
2. Criar o Dockerfile de produção do frontend.
3. Criar o Compose de produção e validá-lo localmente.
4. Criar o workflow inicial de CI com testes, lint e builds.

Os quatro itens foram implementados em 2026-09-04. O fluxo de release, o instalador
e os scripts operacionais também foram adicionados. Permanecem como validações de
homologação: publicar uma tag de teste, executar a instalação e a atualização em
uma máquina Windows limpa e configurar a assinatura digital antes da distribuição
comercial.

Antes de cada atualização, `update.ps1` bloqueia a operação se houver Sessão em
andamento e grava um dump SQL datado em `ARENAX_DATA_PATH/backups`. Em caso de
falha, ele volta a fixar a versão anterior. Uma recuperação de banco pode ser feita
explicitamente por um administrador com `restore.ps1`; a operação exige confirmação
e mantém os serviços de aplicação parados se o PostgreSQL rejeitar o dump.

## Critério de conclusão

Uma tag de teste deve gerar automaticamente imagens versionadas e um instalador
Windows disponível em uma GitHub Release. Em uma máquina limpa e compatível, o
instalador deve iniciar a ARENAX, permitir a configuração inicial e preservar todos
os dados após uma atualização de versão.
