# Espaço como recurso físico genérico

## Status
Aceita.

## Decisão

Somente Espaços com estado administrativo `active` podem ser incluídos em uma
nova Sessão. Espaços em manutenção ou desativados permanecem no histórico, mas
não ficam disponíveis para novos agendamentos.
Usaremos Espaço, inclusive na interface, para representar Society, Beach Tennis, campo, churrasqueira, salão e outros recursos reserváveis.

## Consequências
- Mantém a linguagem consistente.
- Reduz acoplamento.
- Deve orientar novas funcionalidades.
- Estados administrativos do MVP: `active`, `maintenance` e `disabled`, apresentados
  como Ativo, Manutenção e Desativado.
- Proprietário e administrador podem criar, editar e excluir Espaços; operador pode consultar.
- Um Espaço com Sessão ou Equipamento vinculado não pode ser excluído. Seu estado
  administrativo deve ser alterado para preservar o histórico.
