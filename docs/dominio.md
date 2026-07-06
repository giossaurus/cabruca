# Modelo de Domínio — Cabruca

Fonte: `rascunhos_iniciais.md`. Este documento é o **contrato vivo** das regras. Quando uma regra mudar, atualize aqui e no teste correspondente (o teste é a especificação executável).

## Visão geral

O jogador cultiva cacau no sistema **cabruca** (cacau sob sombra de nativas da Mata Atlântica). Objetivo: prosperar **sem** destruir o ecossistema, mantendo três indicadores equilibrados. Loop central: agir com energia → **dormir** → o mundo avança um dia.

## Entidades e regras

### 1. Grade / Nível de Sombra — `ShadeGrid`

Analogia: pense na sombra como **Wi-Fi**. Cada árvore nativa **madura** é um roteador que cobre os 8 tiles à sua volta (vizinhança de Moore). O cacau quer sinal "na medida": zero sinal = sol demais, muito sinal = sombra demais.

- Sombra vem **só de árvores nativas maduras** (idade ≥ 2 dias). Cacaueiro **não** gera sombra.
- `shadeLevelAt(tile)` = nº de nativas maduras nos 8 vizinhos.
  - `0` = **Sol Pleno**, `1` = **Ideal**, `2+` = **Mata Fechada**.
- Duas árvores cobrindo o mesmo tile → nível 2.
- Árvore recém-plantada não gera sombra; amadurece em **2 dias**.
- Recalcular ao plantar/remover árvore e ao iniciar o dia.
- A árvore ocupa o próprio tile (bloqueia plantio de cacau ali).

### 2. Cacaueiro — `Cacao`

Estágios: `muda → jovem → crescendo → maduro`. Cresce conforme a sombra do seu tile a cada dia:

- **Sol Pleno (0):** estresse, **não** cresce. **3 dias consecutivos → morre.**
- **Ideal (1):** crescimento normal.
- **Mata Fechada (2+):** estágio fica **+1 dia** mais lento.
- `harvestable` quando atinge `maduro`.

### 3. Indicadores — `Indicators`

Ver [ADR 0003](adr/0003-modelo-de-indicadores.md). Três valores em [0, 100], começam em 50; ações aplicam deltas com clamp.

### 4. Inventário — `Inventory`

Analogia: **estante de potes**. Cada slot é um pote que só guarda um tipo; o mesmo tipo empilha no mesmo pote. Sem pote livre para um tipo novo, o item não é coletado.

- N slots (10 iniciais, a confirmar). 1 tipo por slot, empilhável.
- `add` retorna quanto foi coletado (pode ser parcial se lotar); `canAdd` consulta sem alterar.
- `maxStack` opcional (default ilimitado) — transborda para outro slot ao exceder.

### 5. Cadeia de processamento (a implementar)

`Cacau Fresco → Nibs → Chocolate`. Cada estrutura ocupa espaço na fazenda e gera produtos em períodos distintos; valor cresce ao longo da cadeia. Modelar como transformação de itens do inventário com tempo (contado em dias no `advanceDay`).

### 6. Loja / Economia (a implementar)

Comprar sementes/mudas, vender produtos (mercado vs. cooperativa local). Vendas movem **Economia**; vender à cooperativa e diversificar movem **Comunidade**.

## Estado atual do core

| Módulo | Arquivo | Status | Testes |
|---|---|---|---|
| Nível de Sombra | `src/domain/shade/ShadeGrid.ts` | Implementado | 9 |
| Cacaueiro | `src/domain/crop/Cacao.ts` | Implementado | 7 |
| Inventário | `src/domain/inventory/Inventory.ts` | Implementado | 8 |
| Indicadores | `src/domain/indicators/Indicators.ts` | Implementado | 4 |
| Turno/dia (orquestrador) | `src/domain/farm/Farm.ts` | Implementado | 12 |
| Balanceamento | `src/domain/farm/balance.ts` | Implementado (constantes tunáveis) | — |
| Processamento | — | A fazer | — |
| Loja/Economia (compra) | parcial: `Farm.sell` | Vender pronto; comprar a fazer | — |

**40 testes passando.** Rode com `npm test`.

### 7. Orquestrador de turno — `Farm`

Agrega as peças acima e é a **única fonte da verdade** do jogo (o adapter Phaser só chama ações e
redesenha via `snapshot()`). Guarda `ShadeGrid` + inventário + indicadores + um `Map` de `Cacao` por
tile, além de energia, dia e fase (`jogando`/`vitoria`/`derrota`).

- Ações (gastam energia, aplicam deltas de indicador): `plantTree`, `plantCacao`, `harvest`, `sell`.
- `sleep()` avança um dia: envelhece árvores, cresce cada cacau pela sombra atual do seu tile, cobra
  a manutenção diária (`dailyDecay`), recarrega energia e reavalia a fase.
- **Fim de jogo:** derrota imediata se algum indicador chega a 0; ao fim de `totalDays`, **vitória**
  se `allAbove(winThreshold)`, senão derrota. Ver [ADR 0003](adr/0003-modelo-de-indicadores.md).

## Perguntas em aberto (do rascunho)

- Nº de slots iniciais do inventário (10?).
- Onde compra / onde vende / quando pode usar a loja.
- Balanceamento inicial (deltas por ação, tempos de crescimento, preços).
- Mecânicas de Polinização e Poda (citadas, sem regra definida).
