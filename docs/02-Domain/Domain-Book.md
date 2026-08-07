# Domain Book — ARENAX

## Core Domain
O Core Domain é a **operação de uma Arena através de Sessões realizadas em Espaços**.

## Sessão
A Sessão representa a utilização de um ou mais Espaços em determinado período e centraliza Responsável, Pessoas relacionadas, Espaços, período previsto/real, Pagamentos, Momentos, Replays, Compartilhamentos, Eventos, Ocorrências, Timeline e Auditoria.

### Estados
Rascunho; Agendada; Confirmada; Em andamento; Finalizada; Arquivada; Cancelada; Não compareceu.

### Regras
- Deve possuir ao menos um Espaço.
- Pode utilizar vários Espaços.
- Não pode haver sobreposição para o mesmo Espaço.
- Duração configurável em blocos de minutos.
- Pode ser prorrogada se não houver conflito.
- Pode existir sem pagamento.
- Pagamento pode ocorrer antes, durante ou depois.
- Momento via AX Button só é aceito com Sessão ativa para o Espaço.

## Espaço
Qualquer recurso físico da Arena que participe de uma Sessão: Society, Beach Tennis, campo, churrasqueira, salão etc. Pode possuir Equipamentos e capacidades.

## Momento e Replay
O acionamento físico solicita um **Momento**. Replay é o conteúdo de vídeo produzido para esse Momento. No futuro, um Momento pode representar gol, defesa, ponto ou outro evento.

## Pessoa / Responsável
Pessoa é o cadastro básico. Em uma Sessão, pode exercer o papel de Responsável. Participantes detalhados ficam fora do MVP.

## Equipamento
Hardware físico. Tipos iniciais: Câmera IP e AX Device. Futuramente: placar, iluminação, catraca e sensores.
