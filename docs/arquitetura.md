# Arquitetura

## Princípio: core-adapter

Ver [ADR 0002](adr/0002-arquitetura-core-adapter.md). Duas camadas, uma dependência só (adapter → core, nunca o contrário):

```
┌─────────────────────────────────────────┐
│  src/game/  (ADAPTER — Phaser)           │
│  cenas, sprites, input, áudio, UI        │
│  desenha o estado e traduz o input       │
└───────────────────┬─────────────────────┘
                    │ chama
                    ▼
┌─────────────────────────────────────────┐
│  src/domain/  (CORE — TS puro)           │
│  regras determinísticas, testáveis       │
│  ShadeGrid · Cacao · Inventory · ...     │
│  NÃO importa phaser                       │
└─────────────────────────────────────────┘
```

## Estrutura de pastas

```
working_title_gamejam/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
├─ rascunhos_iniciais.md        # game design original
├─ docs/
│  ├─ README.md                 # índice das referências
│  ├─ dominio.md                # modelo de domínio (contrato vivo)
│  ├─ arquitetura.md            # este arquivo
│  ├─ plano-7-dias.md           # roadmap da jam
│  └─ adr/
│     ├─ 0001-escolha-da-engine.md
│     ├─ 0002-arquitetura-core-adapter.md
│     └─ 0003-modelo-de-indicadores.md
└─ src/
   ├─ domain/                   # CORE — sem Phaser, 100% testável
   │  ├─ index.ts               # barrel
   │  ├─ types.ts
   │  ├─ shade/    ShadeGrid.ts     + .test.ts
   │  ├─ crop/     Cacao.ts         + .test.ts
   │  ├─ inventory/Inventory.ts     + .test.ts
   │  ├─ indicators/Indicators.ts   + .test.ts
   │  └─ farm/     Farm.ts + .test.ts, balance.ts   # orquestrador de turno + constantes
   └─ game/                     # ADAPTER — Phaser
      ├─ main.ts                # bootstrap do Phaser.Game
      ├─ assets.ts              # contrato de keys de textura (+ placeholders)
      └─ scenes/
         ├─ BootScene.ts        # gera assets, depois vai para o Menu
         ├─ MenuScene.ts        # menu inicial (temporário)
         ├─ FarmScene.ts        # render + input; delega tudo ao Farm
         └─ PauseScene.ts       # menu de pause (lançado por cima da Farm)
      Player.ts                 # avatar: movimento/colisão (input, não é regra)
```

> **Player/movimento vive no adapter, não no domínio.** O avatar anda em pixels (8 direções) e age
> no tile onde pisa; colisão só com árvores maduras. Isso é input/apresentação — coberto por QA
> manual (ADR 0002), não por teste de unidade. O domínio (`Farm`) segue intocado e é a fonte da
> verdade das regras.

## Estratégia de testes (SDD/TDD na prática)

| Camada | Como testar | Quem |
|---|---|---|
| `src/domain` | **TDD** com Vitest — teste primeiro, código depois | Dev Sr. + QA Jr. |
| `src/game` (Phaser) | **QA exploratória manual** (checklist por feature) | QA Jr. |
| Balanceamento | Scripts Node rodando o core headless | Dev Sr. |

Regra prática de jam: **toda regra que dá para escrever como "dado X, quando Y, então Z" vira teste unitário no core.** Render, animação e "feel" não valem TDD sob pressão — cobrir com QA manual.

### Convenções

- Cada módulo de domínio: um arquivo de código + um `.test.ts` ao lado.
- Nomes de teste em pt-BR, no formato "dado/quando/então" enxuto.
- Constantes de balanceamento exportadas (ex.: `SOL_PLENO_DEATH_DAYS`) para tunar sem caçar números mágicos.
- Domínio é imutável na interface pública quando possível (snapshots para render).

## Como rodar

```bash
npm install        # instala Phaser, Vite, Vitest, TypeScript
npm test           # roda os testes do core (Vitest)
npm run test:watch # TDD em watch mode
npm run dev        # sobe o jogo (Vite) em http://localhost:5173
npm run typecheck  # checagem de tipos
```

> O core está verde (40 testes). `npm run dev` requer `npm install` completo (Phaser).
