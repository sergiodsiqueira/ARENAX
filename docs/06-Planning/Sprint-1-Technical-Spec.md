# Sprint 1 — Especificação técnica executável

## Escopo
Vertical slice: cadastrar Pessoa, Espaço, Câmera e AX Device; criar/iniciar Sessão;
receber acionamento idempotente; localizar Sessão ativa; criar Momento e outbox;
gerar Replay; atualizar Timeline.

## Critérios de aceite
1. Uma Sessão sem Espaço ou com período inválido é rejeitada.
2. Intervalos são semiabertos e instantes exigem fuso.
3. Sessões bloqueadoras não se sobrepõem no mesmo Espaço, inclusive sob concorrência.
4. O início é aceito para Sessão Agendada ou Confirmada.
5. Device desconhecido e ausência de Sessão ativa são auditados sem criar Momento.
6. Device válido em Espaço com Sessão ativa cria exatamente um Momento por chave de idempotência.
7. Momento e `ReplayRequested` são persistidos atomicamente.
8. O worker registra `ReplayGenerated` ou `ReplayGenerationFailed` na Timeline.

## Contrato
O contrato versionado está em `docs/03-Architecture/openapi.yaml`. A documentação
interativa do runtime fica em `/docs`.

## Limite consciente do primeiro slice
O adapter de vídeo usa `configuration.source_path` de uma Câmera apontando para um
arquivo local continuamente atualizado. Buffer RTSP segmentado, retenção e múltiplas
câmeras permanecem como evolução do Capture Service, sem alterar domínio ou firmware.

