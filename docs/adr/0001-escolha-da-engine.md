# ADR 0001 — Escolha da engine: Phaser 3 + TypeScript

- **Status:** Aceito
- **Data:** 2026-07-05
- **Contexto da Jam:** Game Jam "Aqui é BR" (05–11/07). Time de 2 pessoas: 1 dev Sr. fullstack (TS/JS/Python, pouco C#) + 1 QA Jr. com base em desenvolvimento.

## Contexto

O jogo (ver `rascunhos_iniciais.md`) é um *cozy farming + gerenciamento de recurso* tile-based ambientado na Mata Atlântica (cabruca). Tecnicamente:

- Grade de tiles, uma ação por clique, ciclo de dia (dormir avança o tempo).
- **Muita lógica de domínio determinística**: Nível de Sombra por vizinhança, estágios de crescimento, três indicadores acoplados, inventário por slots, cadeia de processamento.
- Camada visual simples: sprites 2D, tilemap, UI.

Estimativa: **~80% do jogo é regra/estado testável, ~20% é renderização/input.**

## Decisão

Usar **Phaser 3 com TypeScript** (build via Vite, testes via Vitest).

## Alternativas consideradas

| Opção | Curva | Reuso da stack | TDD do core | Veredito |
|---|---|---|---|---|
| **Phaser 3 + TS** | Baixa | Total (TS) | Trivial | **Escolhida** |
| Godot 4 (GDScript) | Baixa-média | Baixo (nova linguagem) | Indireto | Boa, mas menos reuso |
| Unity (C#) | Alta | Baixo (pouco C#) | Médio | Overkill p/ 2D em 7 dias |
| Canvas puro / TS | Média | Total | Trivial | Reinventa tilemap/sprite/input |

## Justificativa

1. **Zero linguagem nova** — o dev Sr. já domina TS; a QA Jr. contribui no mesmo idioma.
2. **Reuso de ferramental** — Vitest, ESLint, npm, tudo que o time já usa.
3. **Deploy web instantâneo** — a banca abre no navegador, sem instalar nada.
4. **Encaixa com domain-first + TDD** — o núcleo de regras fica em TS puro, sem `import` de Phaser (ver [ADR 0002](0002-arquitetura-core-adapter.md)).
5. Phaser entrega tilemap, sprites, input e cenas prontos — não precisamos de engine pesada (Unity/Unreal) para um 2D tile-based.

## Consequências

- **Positivas:** produtividade imediata, core 100% testável, iteração rápida, build leve.
- **Negativas:** sem editor visual de cenas (montamos mapa por código/dados); física avançada não é nativa (não precisamos dela aqui).
- **Risco de reversão:** se o escopo virar 3D/físico pesado, reavaliar Godot. Improvável dentro da jam.

## Ver também

Deploy/distribuição (web GCP/KVM, wrapper Rust/Electron) e linguagens de suporte (Python p/ tooling,
Vitest/Jest p/ testes) ficam registrados em separado no
[ADR 0004 — Deploy, distribuição e linguagens de suporte](0004-deploy-e-distribuicao.md).
