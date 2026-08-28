# ADR-019 — Pagamentos manuais

## Status
Aceita.

## Contexto
O MVP precisa registrar valores recebidos antes, durante ou depois de uma Sessão,
sem integrar adquirentes, bancos, emissão fiscal ou conciliação automática.

## Decisão
Pagamento pertence ao contexto Financeiro e é uma entidade imutável associada à
Sessão. Uma Sessão pode possuir zero ou vários Pagamentos. Cada registro contém:

- valor inteiro e positivo em centavos;
- método: dinheiro, PIX, cartão de débito, cartão de crédito ou outro;
- instante e Usuário que efetuou o registro;
- observação opcional de até 500 caracteres.

O registro do Pagamento e o evento `PaymentRegistered` da Timeline são persistidos
na mesma transação. Pagamentos podem ser registrados em qualquer estado de uma
Sessão existente, pois o recebimento pode acontecer antes, durante ou depois do
uso do Espaço.

## Consequências
O MVP não edita nem exclui Pagamentos. Conforme a ADR-020, apresenta valor previsto,
total pago e saldo simples, sem declarar quitação. Estorno, correção auditável,
cobrança, parcelamento, taxas e integração
financeira exigem decisão posterior. O frontend apenas apresenta os registros e
envia a intenção; as invariantes permanecem no backend.
