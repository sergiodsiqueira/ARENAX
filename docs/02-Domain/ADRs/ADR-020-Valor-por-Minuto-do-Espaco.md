# ADR-020 — Valor por minuto do Espaço

## Status
Aceita.

## Decisão
Cada Espaço possui um valor por minuto, inteiro e não negativo, armazenado em
centavos. Ao criar uma Sessão, o valor vigente de cada Espaço é copiado para o
vínculo `sessao_espacos`, preservando o preço histórico.

O valor previsto da Sessão é a duração prevista em minutos, arredondada para cima
quando houver minuto parcial, multiplicada pela soma dos valores por minuto dos
Espaços. Prorrogações recalculam a duração usando os mesmos valores fotografados.

A configuração global `calcular_tempo_real`, ativa por padrão, escolhe a base de
tempo do cálculo automático. Ativa, usa início/fim reais ou o instante atual para
Sessão em andamento; antes do início real, o cálculo é zero. Desativada, usa o
período previsto. Minutos parciais são arredondados para cima.

O Dossiê apresenta valor previsto, total pago e saldo. O saldo sugerido preenche o
formulário de Pagamento, mas não impede Pagamentos parciais ou valores diferentes.

O Usuário pode substituir explicitamente o valor previsto por um valor manual. A
ação de recalcular remove essa substituição e reutiliza os valores por minuto
fotografados na Sessão; ela nunca consulta o preço atual do cadastro do Espaço.
Alteração manual e recálculo
emitem, respectivamente, `ExpectedAmountChanged` e
`ExpectedAmountRecalculated` na Timeline.

## Consequências
Alterar o valor de um Espaço afeta apenas Sessões criadas depois da alteração.
Abrir o Dossiê ou solicitar recálculo nunca altera o valor por minuto histórico de
uma Sessão existente.
Esta regra não representa tabela de preços, descontos, pacotes ou cobrança pelo
período real; esses recursos exigem decisão futura.
