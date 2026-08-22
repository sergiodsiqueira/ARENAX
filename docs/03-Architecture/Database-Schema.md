# Esquema físico do PostgreSQL

O banco usa nomes em português, sem acentos, para facilitar consultas e evitar
identificadores SQL que exijam aspas. A API e os nomes internos do código podem
permanecer em inglês enquanto os contratos existentes estiverem em vigor.

| Tabela | Finalidade |
|---|---|
| `clientes` | Cadastro de Clientes que podem ser Responsáveis. |
| `espacos` | Recursos físicos da Arena. |
| `equipamentos` | Câmeras e AX Devices associados a Espaços. |
| `sessoes` | Agregado central da operação. |
| `sessao_espacos` | Espaços utilizados por cada Sessão. |
| `momentos` | Momentos solicitados durante uma Sessão. |
| `eventos_fisicos` | Auditoria dos acionamentos físicos recebidos. |
| `linha_do_tempo` | Eventos operacionais de cada Sessão. |
| `caixa_de_saida` | Entrega confiável dos pedidos de Replay. |
| `usuarios` | Identidades autorizadas a acessar a plataforma. |
| `acessos` | Sessões de autenticação revogáveis dos Usuários. |

## Colunas principais

- `sessoes`: `responsavel_id`, `inicio_previsto`, `fim_previsto`, `inicio_real`, `fim_real`.
- `espacos`: `nome`, `status_administrativo`.
- `clientes`: `nome`, `status_administrativo`.
- `equipamentos`: `espaco_id`, `tipo`, `identificador_externo`, `configuracao`, `status_administrativo`.
- `momentos`: `sessao_id`, `espaco_id`, `ocorrido_em`, `caminho_replay`.
- `eventos_fisicos`: `dispositivo_id`, `ocorrido_em`, `chave_idempotencia`, `aceito`.
- `linha_do_tempo`: `sessao_id`, `tipo`, `ocorrido_em`, `dados`.
- `caixa_de_saida`: `tipo`, `agregado_id`, `dados`, `publicado_em`.
- `usuarios`: `nome`, `email`, `senha_hash`, `papel`, `status`, `ultimo_acesso_em`.
- `acessos`: `usuario_id`, `token_hash`, `criado_em`, `expira_em`, `revogado_em`.

Os valores técnicos de status e tipos de evento permanecem estáveis para preservar
compatibilidade com domínio, API e integrações.
