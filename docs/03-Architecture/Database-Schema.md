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
| `pagamentos` | Registros manuais e imutáveis de valores recebidos por Sessão. |
| `eventos_fisicos` | Auditoria dos acionamentos físicos recebidos. |
| `linha_do_tempo` | Eventos operacionais de cada Sessão. |
| `caixa_de_saida` | Entrega confiável dos pedidos de Replay. |
| `usuarios` | Identidades autorizadas a acessar a plataforma. |
| `acessos` | Sessões de autenticação revogáveis dos Usuários. |
| `tokens_redefinicao_senha` | Tokens opacos temporários usados na recuperação local de senha. |
| `configuracoes` | Valores operacionais globais da Arena no MVP. |

## Colunas principais

- `sessoes`: `responsavel_id`, `inicio_previsto`, `fim_previsto`, `inicio_real`,
  `fim_real`, `valor_previsto_manual_centavos`.
- `espacos`: `nome`, `status_administrativo`, `valor_minuto_centavos`.
- `sessao_espacos`: `sessao_id`, `espaco_id`, `valor_minuto_centavos` como
  fotografia do preço aplicado à Sessão.
- `clientes`: `nome`, `tipo`, `documento`, `cep`, `endereco`, `cidade`, `uf`,
  `telefone`, `email`, `whatsapp`, `observacoes` em texto livre e
  `status_administrativo`.
  `documento` aceita vazio e possui índice único parcial quando informado.
- `equipamentos`: `espaco_id`, `tipo`, `identificador_externo`, `configuracao`, `status_administrativo`.
- `momentos`: `sessao_id`, `espaco_id`, `ocorrido_em`, `caminho_replay`.
- `pagamentos`: `sessao_id`, `valor_centavos`, `metodo`, `observacao`,
  `registrado_em`, `registrado_por`.
- `eventos_fisicos`: `dispositivo_id`, `ocorrido_em`, `chave_idempotencia`, `aceito`.
- `linha_do_tempo`: `sessao_id`, `tipo`, `ocorrido_em`, `dados`.
- `caixa_de_saida`: `tipo`, `agregado_id`, `dados`, `publicado_em`.
- `usuarios`: `nome`, `email`, `senha_hash`, `papel`, `status`, `ultimo_acesso_em`.
- `acessos`: `usuario_id`, `token_hash`, `criado_em`, `expira_em`, `revogado_em`.
- `tokens_redefinicao_senha`: `usuario_id`, `token_hash`, `criado_em`,
  `expira_em`, `usado_em`.
- `configuracoes`: `duracao_padrao_sessao_minutos`,
  `duracao_replay_anterior_segundos`, `duracao_replay_posterior_segundos`,
  `calcular_tempo_real`, `retencao_replays_dias` anulável, `cnpj`, `nome_empresa`,
  `nome_fantasia`, `cep`, `endereco`, `cidade`, `estado`, `telefone`, `atualizado_em`.

## Configurações iniciais

Como o MVP atende uma única Arena, `configuracoes` possui um único registro criado
pela migration, com os valores:

| Coluna | Valor inicial |
|---|---:|
| `duracao_padrao_sessao_minutos` | `60` |
| `duracao_replay_anterior_segundos` | `30` |
| `duracao_replay_posterior_segundos` | `5` |
| `calcular_tempo_real` | `true` |

A duração da Sessão deve ser positiva. As parcelas anterior e posterior do Replay
não podem ser negativas e sua soma deve ser maior que zero. O registro é atualizado
no lugar; não é criado um registro por Usuário, Espaço ou Sessão.

Quando `calcular_tempo_real` está ativo, o valor da Sessão usa o período real. Uma
Sessão ainda não iniciada possui zero minutos reais; uma Sessão em andamento usa o
instante atual; uma Sessão encerrada usa seu fim real. Quando desativado, usa o
período previsto.

Os valores técnicos de status e tipos de evento permanecem estáveis para preservar
compatibilidade com domínio, API e integrações.
