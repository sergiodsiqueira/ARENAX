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
| P2 | Arena Designer | Editor visual. |
| P2 | Configurações | Duração padrão de Sessão e janela anterior/posterior de Replay. |
| P2 | Compartilhamento | Última entrega do MVP. Forma de acesso e exposição dos Replays será decidida futuramente. |
| P3 | Dashboard TV | Visão ampliada. |

## Priorização
Perguntar: a qual contexto pertence? relaciona-se a Sessão? melhora operação? é necessária ao MVP?

## Decisão de sequenciamento
O Compartilhamento de Replays, incluindo qualquer link acessível sem autenticação,
fica como a última entrega do MVP. A arquitetura de acesso — rede local, internet,
armazenamento em nuvem ou modelo híbrido — ainda não foi decidida e não deve ser
presumida durante as entregas anteriores.
