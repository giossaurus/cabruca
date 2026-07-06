# ADR 0003 — Modelo dos três indicadores de equilíbrio

- **Status:** Aceito
- **Data:** 2026-07-05

## Contexto

O diferencial do jogo é não vencer só por dinheiro: o jogador equilibra **Biodiversidade + Economia + Comunidade** (rascunhos_iniciais.md). Precisamos de um modelo simples de balancear e fácil de ajustar durante a jam.

## Decisão

Cada indicador é um valor **inteiro/real em [0, 100]**, iniciando em **50**. As ações do jogo aplicam **deltas** (ex.: vender aumenta Economia, desmatar reduz Biodiversidade), sempre com *clamp* em [0, 100].

- Implementado em `src/domain/indicators/Indicators.ts`.
- `apply({ economia: +10, biodiversidade: -5 })` — parcial, só mexe no que veio.
- Métricas de equilíbrio expostas: `min()`, `average()`, `allAbove(threshold)`.

### Relações (do doc) — a serem afinadas no balanceamento

- **Biodiversidade** ← árvores nativas preservadas, polinizadores, diversidade de cultivos. → fauna visitante, regeneração de recursos.
- **Economia** ← vendas, produtividade, processamento. → comprar sementes, expandir fazenda.
- **Comunidade** ← venda à cooperativa, diversidade de produtos, feiras, ajudar vizinhos. → turistas, bônus de preço, mudas nativas, prêmios, pesquisadores.

## Condições de vitória/derrota (proposta inicial, ajustável)

- **Derrota/alerta** se algum indicador chega a 0 (ou fica abaixo de um piso por N dias) — usar `min()`.
- **Sucesso** ao manter `allAbove(threshold)` até o fim do período — reforça o equilíbrio, não a maximização.

## Consequências

- Números centralizados e fáceis de tunar (constantes/tabela de deltas por ação).
- Testável isoladamente; o balanceamento vira dado, não código espalhado.
- Deixa em aberto (intencional na jam): curva de dificuldade, pesos exatos, efeitos de retroalimentação (ex.: Biodiversidade alta acelera regeneração).
