# Sessão como Aggregate Root

## Status
Aceita.

## Decisão
Operações que afetam o ciclo da utilização devem ser validadas pelo agregado Sessão, preservando invariantes e evitando regras espalhadas.

## Consequências
- Mantém a linguagem consistente.
- Reduz acoplamento.
- Deve orientar novas funcionalidades.
