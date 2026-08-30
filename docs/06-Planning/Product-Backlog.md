# Product Backlog Inicial

| Prioridade | Item | Resultado |
|---|---|---|
| P0 | Estrutura | Ambiente local executável. |
| P0 | Contratos API | OpenAPI do Core. |
| P0 | PostgreSQL/migrações | Persistência versionada. |
| P0 | Sessão | Criar/consultar/iniciar/prorrogar/finalizar/cancelar. |
| P0 | Conflitos | Impedir sobreposição de Espaços. |
| P1 | Clientes | Cadastro e Responsável. |
| P1 | Espaços | CRUD incluindo DELETE controlado. |
| P1 | Equipamentos | Câmeras/AX Devices incluindo DELETE controlado. |
| P1 | Agenda | Sessões por data/Espaço. |
| P1 | Mission Control | Operação e cronômetros. |
| P1 | AX Event | Receber acionamento ESP32. |
| P1 | Capture Service | Buffer contínuo. |
| P1 | Replay Worker | Vídeo retroativo/posterior. |
| P1 | Momento | Associar Replay à Sessão. |
| P2 | Pagamento | Registro manual imutável por Sessão. **Implementado.** |
| P2 | Health Center | Saúde de infraestrutura. |
| P2 | Configurações | Padrões de Sessão/Replay, retenção sem remoção automática por padrão e diretório local de mídia. |
| P2 | Compartilhamento | Download e compartilhamento local autenticado, com fallback para WhatsApp sem anexo automático. |
| P3 | Dashboard TV | Visão ampliada. |
| Pós-v1 | Arena Designer | Editor visual removido da v1. |

## Priorização
Perguntar: a qual contexto pertence? relaciona-se a Sessão? melhora operação? é necessária ao MVP?

## Decisão de sequenciamento
O Compartilhamento de Replays fica como a última entrega do MVP. A v1 será instalada
na máquina local da Arena, funcionará somente na rede local e não oferecerá link
público. Os arquivos permanecerão em armazenamento local configurável. Validade,
experiência de entrega e granularidade da auditoria ainda precisam ser fechadas.
