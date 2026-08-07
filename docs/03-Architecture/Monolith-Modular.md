# Monólito Modular

## Decisão
O MVP não começará com microsserviços.

## Motivos
Menor complexidade operacional, transações simples, debug/desenvolvimento local mais fáceis, equipe inicial pequena e domínio ainda em validação.

Mesmo no monólito, Operação, Infraestrutura, Momentos/Replay, Financeiro e Pessoas devem possuir módulos claros.

Capture Service e Replay Worker podem ser processos separados devido ao perfil contínuo/pesado de vídeo.
