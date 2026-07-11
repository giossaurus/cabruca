import { describe, it, expect } from 'vitest';
import { Farm } from './Farm';
import { ITEM_CACAU_FRESCO } from './balance';

/**
 * Rodeia um tile central com árvores nativas e dorme até elas amadurecerem,
 * deixando o tile central em sombra "ideal" (nível 1) ou "mata fechada".
 */
function plantTreesAround(farm: Farm, center: { x: number; y: number }, n: number): void {
  const around = [
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
  ];
  for (let i = 0; i < n; i++) {
    const d = around[i]!;
    expect(farm.plantTree({ x: center.x + d.x, y: center.y + d.y })).toBe(true);
  }
}

describe('Farm — energia', () => {
  it('plantar consome energia', () => {
    const farm = new Farm({ startEnergy: 3, energyCost: { plantTree: 1, plantCacao: 1, harvest: 1, prune: 1, replantTree: 2 } });
    expect(farm.energy).toBe(3);
    farm.plantTree({ x: 0, y: 0 });
    expect(farm.energy).toBe(2);
  });

  it('não age sem energia suficiente', () => {
    const farm = new Farm({ startEnergy: 1, energyCost: { plantTree: 1, plantCacao: 1, harvest: 1, prune: 1, replantTree: 2 } });
    expect(farm.plantTree({ x: 0, y: 0 })).toBe(true);
    expect(farm.energy).toBe(0);
    expect(farm.plantTree({ x: 1, y: 0 })).toBe(false); // sem energia
    expect(farm.grid.isEmpty({ x: 1, y: 0 })).toBe(true);
  });

  it('dormir recarrega a energia', () => {
    const farm = new Farm({ startEnergy: 5, totalDays: 20 });
    farm.plantTree({ x: 0, y: 0 });
    expect(farm.energy).toBe(4);
    farm.sleep();
    expect(farm.energy).toBe(5);
    expect(farm.day).toBe(2);
  });
});

describe('Farm — cacau × sombra', () => {
  it('no sol pleno o cacau morre após 3 dormidas', () => {
    const farm = new Farm({ startEnergy: 20, totalDays: 20, initialTrees: [] });
    farm.plantCacao({ x: 4, y: 4 }); // sem árvores por perto = sol pleno
    farm.sleep();
    farm.sleep();
    expect(farm.snapshot().tiles.find((t) => t.x === 4 && t.y === 4)?.cacao?.dead).toBe(false);
    farm.sleep();
    expect(farm.snapshot().tiles.find((t) => t.x === 4 && t.y === 4)?.cacao?.dead).toBe(true);
  });

  it('cresce e fica colhível sob sombra ideal', () => {
    const farm = new Farm({
      startEnergy: 40, totalDays: 40, daysPerCacaoStage: 1, treeMaturityDays: 1, initialTrees: [],
    });
    const center = { x: 4, y: 4 };
    plantTreesAround(farm, center, 1); // 1 nativa vizinha = nível 1 (ideal) quando madura
    farm.sleep(); // nativa amadurece (maturidade 1) antes de plantar o cacau
    farm.plantCacao(center);
    for (let i = 0; i < 3; i++) farm.sleep(); // 3 estágios a 1 dia → maduro
    const view = farm.snapshot().tiles.find((t) => t.x === center.x && t.y === center.y);
    expect(view?.cacao?.stage).toBe('maduro');
    expect(view?.cacao?.harvestable).toBe(true);
  });
});

describe('Farm — colheita e venda', () => {
  it('fecha o ciclo plantio → crescimento → colheita → venda do cacau', () => {
    const farm = new Farm({
      startEnergy: 60, totalDays: 40, daysPerCacaoStage: 1, treeMaturityDays: 1, initialTrees: [],
    });
    const center = { x: 4, y: 4 };
    plantTreesAround(farm, center, 1);
    farm.sleep();

    expect(farm.plantCacao(center)).toBe(true);
    for (let i = 0; i < 3; i++) farm.sleep();
    expect(farm.harvest(center)).toBe(true);
    expect(farm.inventory.count(ITEM_CACAU_FRESCO)).toBe(1);

    const eco0 = farm.indicators.get('economia');
    const sold = farm.sell(ITEM_CACAU_FRESCO, farm.inventory.count(ITEM_CACAU_FRESCO));
    expect(sold).toBe(1);
    expect(farm.inventory.count(ITEM_CACAU_FRESCO)).toBe(0);
    expect(farm.indicators.get('economia')).toBeGreaterThan(eco0);
  });

  it('colher enche o inventário e libera o tile', () => {
    const farm = new Farm({
      startEnergy: 60, totalDays: 40, daysPerCacaoStage: 1, treeMaturityDays: 1, initialTrees: [],
    });
    const center = { x: 4, y: 4 };
    plantTreesAround(farm, center, 1);
    farm.sleep(); // nativa amadurece antes de plantar o cacau
    farm.plantCacao(center);
    for (let i = 0; i < 3; i++) farm.sleep();
    expect(farm.harvest(center)).toBe(true);
    expect(farm.inventory.count(ITEM_CACAU_FRESCO)).toBe(1);
    expect(farm.grid.isEmpty(center)).toBe(true);
  });

  it('não colhe cacau que não está maduro', () => {
    const farm = new Farm({ startEnergy: 10 });
    farm.plantCacao({ x: 4, y: 4 });
    expect(farm.harvest({ x: 4, y: 4 })).toBe(false);
  });

  it('vender move a Economia e reduz o inventário', () => {
    const farm = new Farm({ startEnergy: 10 });
    farm.inventory.add(ITEM_CACAU_FRESCO, 3);
    const eco0 = farm.indicators.get('economia');
    const sold = farm.sell(ITEM_CACAU_FRESCO, 2);
    expect(sold).toBe(2);
    expect(farm.inventory.count(ITEM_CACAU_FRESCO)).toBe(1);
    expect(farm.indicators.get('economia')).toBeGreaterThan(eco0);
  });
});

describe('Farm — poda', () => {
  // Nativa já madura no cenário (initialTrees são semeadas maduras).
  const withMatureTree = (extra = {}) =>
    new Farm({ startEnergy: 10, totalDays: 40, treeMaturityDays: 1, initialTrees: [{ x: 3, y: 3 }], ...extra });

  it('só poda nativa madura (não muda imatura, cacau ou tile vazio)', () => {
    const farm = withMatureTree();
    farm.plantTree({ x: 0, y: 0 }); // recém-plantada = imatura
    farm.plantCacao({ x: 6, y: 6 });
    expect(farm.prune({ x: 0, y: 0 })).toBe(false); // imatura
    expect(farm.prune({ x: 6, y: 6 })).toBe(false); // cacau
    expect(farm.prune({ x: 7, y: 7 })).toBe(false); // vazio
    expect(farm.prune({ x: 3, y: 3 })).toBe(true); // madura
  });

  it('podar gasta energia e reduz a biodiversidade', () => {
    const farm = withMatureTree();
    const bio0 = farm.indicators.get('biodiversidade');
    const energy0 = farm.energy;
    expect(farm.prune({ x: 3, y: 3 })).toBe(true);
    expect(farm.energy).toBe(energy0 - 1);
    expect(farm.indicators.get('biodiversidade')).toBe(bio0 - 2);
  });

  it('não poda sem energia suficiente', () => {
    const farm = withMatureTree({ startEnergy: 0 });
    const bio0 = farm.indicators.get('biodiversidade');
    expect(farm.prune({ x: 3, y: 3 })).toBe(false);
    expect(farm.snapshot().tiles.find((t) => t.x === 3 && t.y === 3)?.pruned).toBe(false);
    expect(farm.indicators.get('biodiversidade')).toBe(bio0);
  });

  it('re-podar não gasta energia nem reduz biodiversidade de novo', () => {
    const farm = withMatureTree();
    expect(farm.prune({ x: 3, y: 3 })).toBe(true);
    const bio1 = farm.indicators.get('biodiversidade');
    const energy1 = farm.energy;
    expect(farm.prune({ x: 3, y: 3 })).toBe(false);
    expect(farm.energy).toBe(energy1);
    expect(farm.indicators.get('biodiversidade')).toBe(bio1);
  });

  it('não poda após o fim de jogo', () => {
    const farm = withMatureTree({ totalDays: 1, winThreshold: 10, dailyDecay: {} });
    farm.sleep(); // dia 2 > 1 → fim (vitória)
    expect(farm.phase).not.toBe('jogando');
    expect(farm.prune({ x: 3, y: 3 })).toBe(false);
  });

  it('colher ao lado de nativa podada rende base + bônus (acumula por árvore)', () => {
    const farm = new Farm({
      startEnergy: 60, totalDays: 40, daysPerCacaoStage: 1, treeMaturityDays: 1,
      initialTrees: [{ x: 3, y: 3 }],
    });
    farm.plantCacao({ x: 4, y: 4 }); // vizinho da nativa madura = sombra ideal
    for (let i = 0; i < 3; i++) farm.sleep(); // cresce até maduro
    farm.prune({ x: 3, y: 3 }); // 1 podada adjacente → bônus +1
    expect(farm.harvest({ x: 4, y: 4 })).toBe(true);
    expect(farm.inventory.count(ITEM_CACAU_FRESCO)).toBe(2); // base 1 + bônus 1
  });

  it('colher sem nativa podada adjacente rende só a base', () => {
    const farm = new Farm({
      startEnergy: 60, totalDays: 40, daysPerCacaoStage: 1, treeMaturityDays: 1,
      initialTrees: [{ x: 3, y: 3 }],
    });
    farm.plantCacao({ x: 4, y: 4 });
    for (let i = 0; i < 3; i++) farm.sleep();
    expect(farm.harvest({ x: 4, y: 4 })).toBe(true);
    expect(farm.inventory.count(ITEM_CACAU_FRESCO)).toBe(1);
  });

  it('snapshot expõe pruned=true e matureTree=true na árvore podada', () => {
    const farm = withMatureTree();
    farm.prune({ x: 3, y: 3 });
    const view = farm.snapshot().tiles.find((t) => t.x === 3 && t.y === 3);
    expect(view?.pruned).toBe(true);
    expect(view?.matureTree).toBe(true);
  });
});

describe('Farm — replantio de nativa', () => {
  it('remove uma nativa imatura e cobra 2 de energia', () => {
    const farm = new Farm({ startEnergy: 5, initialTrees: [] });
    expect(farm.plantTree({ x: 2, y: 2 })).toBe(true);
    expect(farm.energy).toBe(4);
    expect(farm.replantTree({ x: 2, y: 2 })).toBe(true);
    expect(farm.energy).toBe(2);
    expect(farm.grid.isEmpty({ x: 2, y: 2 })).toBe(true);
  });

  it('não remove nativa madura, cacau ou tile vazio', () => {
    const farm = new Farm({ startEnergy: 10, treeMaturityDays: 1, initialTrees: [{ x: 1, y: 1 }] });
    farm.plantCacao({ x: 2, y: 2 });
    expect(farm.replantTree({ x: 1, y: 1 })).toBe(false);
    expect(farm.replantTree({ x: 2, y: 2 })).toBe(false);
    expect(farm.replantTree({ x: 3, y: 3 })).toBe(false);
  });
});

describe('Farm — fim de jogo', () => {
  it('vitória: manter todos os indicadores acima do piso até o fim', () => {
    const farm = new Farm({ totalDays: 2, winThreshold: 40, dailyDecay: {}, startEnergy: 5 });
    farm.sleep(); // dia 2
    expect(farm.phase).toBe('jogando');
    farm.sleep(); // dia 3 > totalDays → avalia
    expect(farm.phase).toBe('vitoria');
  });

  it('derrota: um indicador chega a zero', () => {
    const farm = new Farm({ totalDays: 20, dailyDecay: { economia: -60 }, startEnergy: 5 });
    farm.sleep(); // economia 50 -> 0
    expect(farm.indicators.get('economia')).toBe(0);
    expect(farm.phase).toBe('derrota');
  });

  it('derrota: fim do período sem equilíbrio', () => {
    const farm = new Farm({ totalDays: 1, winThreshold: 90, dailyDecay: {}, startEnergy: 5 });
    farm.sleep(); // dia 2 > 1, mas indicadores estão em 50 < 90
    expect(farm.phase).toBe('derrota');
  });

  it('após o fim, ações são rejeitadas', () => {
    const farm = new Farm({ totalDays: 1, winThreshold: 10, dailyDecay: {}, startEnergy: 5 });
    farm.sleep();
    expect(farm.phase).toBe('vitoria');
    expect(farm.plantTree({ x: 0, y: 0 })).toBe(false);
  });
});
