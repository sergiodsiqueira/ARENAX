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
Para servidores RTSP sem suporte a transporte intercalado, a Câmera pode definir
`configuration.rtsp_transport` como `udp` ou `udp_multicast`; o padrão é `tcp`.

O Capture Service consome diretamente a URL RTSP configurada. Como navegadores não
reproduzem RTSP nativamente, a API registra essa mesma fonte sob demanda no MediaMTX
e entrega ao frontend somente um canal WebRTC opaco. A fonte é encerrada após o
período sem leitores e suas credenciais não são enviadas ao navegador. Essa rota de
visualização não participa da geração de Replay.

O Replay Worker seleciona os segmentos que intersectam a janela do Momento. A
configuração legada `source_path` permanece temporariamente aceita como fallback.

Um Espaço pode ter várias câmeras; a política de geração não deve exigir mudança de firmware.
