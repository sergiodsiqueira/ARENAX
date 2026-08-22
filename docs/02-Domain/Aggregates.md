# Agregados e Entidades

## Sessão — Aggregate Root principal
Responsável pelo ciclo de vida, Espaços, Responsável, Pagamentos, Momentos, Ocorrências e Timeline.

Operações conceituais: `Criar`, `Confirmar`, `Iniciar`, `Prorrogar`, `RegistrarPagamento`, `SolicitarMomento`, `AdicionarOcorrencia`, `Finalizar`, `Cancelar`.

## Espaço
Identidade, configuração, estado administrativo, capacidades e associação de Equipamentos. Estados como Disponível/Ocupado devem ser derivados das Sessões; Ativo/Manutenção/Desativado pertencem ao Espaço.

## Cliente
Cadastro independente de uma pessoa atendida pela Arena e referenciado pela Sessão.

## Equipamento
Entidade com identidade, tipo, configuração, Espaço associado e estado operacional.

## Momento
Entidade pertencente à Sessão. Representa intenção/acontecimento e pode originar Replay(s).
