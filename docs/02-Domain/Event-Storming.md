# Event Storming

## Comandos
Criar/alterar/confirmar/iniciar/prorrogar/finalizar/cancelar Sessão; registrar Pagamento; cadastrar/alterar/remover Espaço; cadastrar/alterar/remover/associar Equipamento; registrar acionamento físico; solicitar Momento; compartilhar Replay.

## Eventos
`SessionCreated`, `SessionUpdated`, `SessionConfirmed`, `SessionStarted`, `SessionExtended`, `SessionFinished`, `SessionCancelled`, `PaymentRegistered`, `PhysicalButtonPressed`, `MomentRequested`, `MomentCreated`, `ReplayProcessingStarted`, `ReplayGenerated`, `ReplayGenerationFailed`, `ReplayShared`, `EquipmentConnected`, `EquipmentDisconnected`.

## Política — PhysicalButtonPressed
1. Identificar AX Device.
2. Identificar Espaço.
3. Procurar Sessão ativa.
4. Sem Sessão: não gerar Replay; registrar evento técnico.
5. Com Sessão: gerar `MomentRequested`.

## Política — MomentRequested
Localizar câmeras habilitadas, enfileirar processamento e aplicar duração retroativa/posterior configurada.

## Política — ReplayGenerated
Associar conteúdo ao Momento/Sessão, atualizar Timeline/Mission Control e disponibilizar compartilhamento.
