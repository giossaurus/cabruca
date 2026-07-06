# ADR 0002 — Arquitetura core-adapter (domínio puro isolado do Phaser)

- **Status:** Aceito
- **Data:** 2026-07-05

## Contexto

Queremos TDD real e modelagem de domínio primeiro, mas engines de jogo dificultam testes quando a lógica fica acoplada a objetos de framework (cenas, sprites, `update()`). Precisamos separar o que é **regra** do que é **render/input**.

## Decisão

Adotar uma arquitetura **hexagonal enxuta** (core-adapter):

- **`src/domain/`** — núcleo puro. TypeScript sem nenhum `import` de Phaser. Determinístico: dado o mesmo estado + ação, mesmo resultado. É a **fonte da verdade**.
- **`src/game/`** — adapter Phaser. Cenas, sprites, input, áudio. Guarda instâncias do domínio, **desenha** o estado e **traduz** input em chamadas de domínio. Não contém regra.

Regra de ouro (verificável em revisão): **nenhum arquivo em `src/domain` importa `phaser`.**

## Fluxo

```
input (Phaser)  ->  ação no domínio  ->  novo estado  ->  redraw (Phaser)
   pointerdown       grid.plantTree()     ShadeGrid        atualiza sprites
```

O "dormir" (avançar dia) é uma única transição de domínio (`advanceDay`) que a cena chama e depois redesenha.

## Consequências

- **Core testável por unidade** com Vitest, sem DOM nem canvas (ambiente Node).
- **QA Jr. foca no domínio** — casos de teste claros e didáticos (sombra, inventário, indicadores).
- A camada Phaser **não** é testada por unidade; cobrir com QA exploratória manual ([ADR relacionado: 0002], seção de estratégia de testes em `docs/arquitetura.md`).
- Custo: um pouco de "cola" para sincronizar estado -> sprites. Compensa pela testabilidade.
- **Bônus:** o core roda sem navegador, então dá para prototipar balanceamento via script Node.
