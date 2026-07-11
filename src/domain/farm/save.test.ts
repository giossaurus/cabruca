import { describe, it, expect } from 'vitest';
import { Farm } from './Farm';
import { ITEM_CACAU_FRESCO } from './balance';

/** Round-trip por JSON (o que o localStorage realmente faz). */
function roundTrip(farm: Farm): Farm {
  return Farm.fromState(JSON.parse(JSON.stringify(farm.toState())));
}

describe('Farm — save/restore (toState/fromState)', () => {
  it('restaura o snapshot idêntico após round-trip por JSON', () => {
    const farm = new Farm();
    // Mexe no mundo: planta cacau, poda uma nativa herdada, dorme alguns dias.
    farm.plantCacao({ x: 4, y: 4 });
    farm.prune({ x: 2, y: 1 });
    farm.sleep();
    farm.sleep();

    const restored = roundTrip(farm);
    expect(restored.snapshot()).toEqual(farm.snapshot());
  });

  it('preserva o estado INTERNO do cacau, não só a view (simulação continua igual)', () => {
    const original = new Farm();
    original.plantCacao({ x: 6, y: 4 });
    original.sleep(); // cacau ganha progresso parcial no estágio

    const restored = roundTrip(original);

    // A partir do mesmo ponto, avançar os dois deve produzir estados iguais —
    // só é possível se progress/extraDays/consecutiveSolPleno foram restaurados.
    for (let i = 0; i < 6; i++) {
      original.sleep();
      restored.sleep();
    }
    expect(restored.snapshot()).toEqual(original.snapshot());
  });

  it('preserva inventário, indicadores, dia, energia e fase', () => {
    const farm = new Farm();
    farm.plantCacao({ x: 5, y: 5 });
    // Cresce o cacau até maduro e colhe, para ter itens no inventário.
    for (let i = 0; i < 8; i++) farm.sleep();
    farm.harvest({ x: 5, y: 5 });
    farm.sell(ITEM_CACAU_FRESCO, 1);

    const restored = roundTrip(farm);
    expect(restored.day).toBe(farm.day);
    expect(restored.energy).toBe(farm.energy);
    expect(restored.phase).toBe(farm.phase);
    expect(restored.inventory.slots()).toEqual(farm.inventory.slots());
    expect(restored.indicators.snapshot()).toEqual(farm.indicators.snapshot());
  });

  it('árvores restauradas mantêm idade e poda (sombra idêntica)', () => {
    const farm = new Farm();
    farm.prune({ x: 6, y: 2 }); // poda uma nativa madura herdada
    farm.sleep();

    const restored = roundTrip(farm);
    for (let y = 0; y < farm.grid.height; y++) {
      for (let x = 0; x < farm.grid.width; x++) {
        expect(restored.grid.shadeLevelAt({ x, y })).toBe(farm.grid.shadeLevelAt({ x, y }));
        expect(restored.grid.isPrunedTree({ x, y })).toBe(farm.grid.isPrunedTree({ x, y }));
      }
    }
  });
});
