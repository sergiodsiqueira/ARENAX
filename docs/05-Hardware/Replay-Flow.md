# Fluxo de Replay

## Requisito
Ao pressionar AX Button, produzir vídeo com janela configurável **anterior** e **posterior** ao acionamento (ex.: 30s antes + 5s depois).

```text
Jogador -> AX Button -> ESP32 -> PhysicalButtonPressed
-> API identifica Device/Espaço -> procura Sessão ativa
-> sem Sessão: ignora geração e registra tecnicamente
-> com Sessão: MomentRequested -> fila -> Replay Worker
-> buffer da(s) câmera(s) -> FFmpeg -> ReplayGenerated
-> Momento/Timeline -> Mission Control -> compartilhamento
```

Cada Câmera possui URL de captura configurada. Capture Service mantém estratégia de buffer. Arquivos ficam inicialmente em computador local, em diretório configurável.

No MVP, a URL fica em `equipment.configuration.capture_url`. O Capture Service
descobre Câmeras no PostgreSQL, mantém segmentos por identidade da Câmera em
`/media/buffers/<camera-id>/`, remove segmentos além da retenção configurada e
escreve o estado técnico em `/media/capture-health/<camera-id>.json`.

O Replay Worker seleciona os segmentos que intersectam a janela do Momento. A
configuração legada `source_path` permanece temporariamente aceita como fallback.

Um Espaço pode ter várias câmeras; a política de geração não deve exigir mudança de firmware.
