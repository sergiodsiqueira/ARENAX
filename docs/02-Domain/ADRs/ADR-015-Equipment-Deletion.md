# Exclusão definitiva de Equipamento

## Status
Aceita.

## Contexto
O cadastro administrativo precisa permitir a retirada definitiva de Câmeras e AX
Devices, inclusive quando o Equipamento já foi utilizado na operação. A regra
anterior bloqueava AX Devices que possuíam eventos físicos.

## Decisão
- Proprietário e administrador podem excluir qualquer Equipamento.
- A interface deve solicitar confirmação explícita e informar que a ação é
  irreversível, remove o vínculo com o Espaço e torna indisponível o histórico pelo
  cadastro do Equipamento.
- Sessões, Momentos, Replays e Timeline pertencem ao dossiê da Sessão e não são
  apagados pela exclusão de um Equipamento.
- Eventos físicos já auditados permanecem como fatos técnicos, mesmo sem um
  Equipamento atualmente cadastrado com o mesmo identificador externo.

## Consequências
O cadastro deixa de oferecer continuidade histórica após a exclusão. A auditoria
da Sessão permanece preservada e não há exclusão em cascata sobre o Core Domain.
