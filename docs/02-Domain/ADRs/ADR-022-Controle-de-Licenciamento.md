# ADR-022 — Controle local de licenciamento

## Status

Aceito.

## Contexto

O ARENAX distribuído precisa consultar a autorização comercial da instalação sem
depender permanentemente de conectividade. A interface sozinha não constitui uma
barreira de segurança, pois chamadas diretas à API continuariam possíveis.

## Decisão

- O backend consulta por `GET` o serviço público de licenças usando o CNPJ das
  Configurações Operacionais.
- O estado da licença é persistido no PostgreSQL; cookies não participam da decisão.
- `liberado: false` bloqueia imediatamente todas as funcionalidades operacionais.
- Uma licença liberada pode operar sem internet até o fim do dia indicado por
  `validade`.
- `verificarNovamente` define, em segundos, quando uma nova consulta online deve
  ocorrer. Falhas de conexão são tentadas novamente após cinco minutos.
- Uma instalação que nunca conseguiu consultar o serviço recebe tolerância de dois
  dias contados da inicialização do estado local.
- Somente saúde, autenticação, documentação técnica e consulta do próprio estado de
  licença permanecem acessíveis durante o bloqueio.
- O frontend exibe um aviso não dispensável, mas a decisão autoritativa e o bloqueio
  pertencem ao backend.

## Consequências

O produto continua utilizável durante indisponibilidades curtas da internet sem
estender uma licença além de sua validade. Alterar o relógio ou o banco local está
fora do modelo de ameaça do MVP e deve ser reavaliado antes de uma distribuição com
requisitos antifraude mais fortes.
