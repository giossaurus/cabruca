import { describe, it, expect } from 'vitest';
import { ShadeGrid } from './ShadeGrid';

// Helper: planta uma árvore e a amadurece (avança a maturidade da grade).
function matureTreeAt(grid: ShadeGrid, x: number, y: number) {
  grid.plantTree({ x, y });
  for (let d = 0; d < grid.maturityDays; d++) grid.advanceDay();
}

describe('ShadeGrid — ocupação', () => {
  it('começa com todos os tiles vazios', () => {
    const grid = new ShadeGrid(3, 3);
    expect(grid.isEmpty({ x: 1, y: 1 })).toBe(true);
    expect(grid.tileAt({ x: 1, y: 1 })).toEqual({ kind: 'empty' });
  });

  it('rejeita plantar em tile já ocupado', () => {
    const grid = new ShadeGrid(3, 3);
    grid.plantTree({ x: 1, y: 1 });
    expect(() => grid.plantCacao({ x: 1, y: 1 })).toThrow(/ocupado/);
  });

  it('rejeita coordenada fora dos limites', () => {
    const grid = new ShadeGrid(3, 3);
    expect(() => grid.plantTree({ x: 3, y: 0 })).toThrow(/fora dos limites/);
  });
});

describe('ShadeGrid — maturidade da árvore', () => {
  it('árvore recém-plantada NÃO gera sombra', () => {
    const grid = new ShadeGrid(3, 3);
    grid.plantTree({ x: 1, y: 1 });
    expect(grid.isMatureTree({ x: 1, y: 1 })).toBe(false);
    expect(grid.shadeLevelAt({ x: 0, y: 0 })).toBe(0);
  });

  it('árvore amadurece após o período de maturidade e passa a gerar sombra', () => {
    const grid = new ShadeGrid(3, 3, 2); // maturidade explícita = 2 (teste enxuto)
    grid.plantTree({ x: 1, y: 1 });
    grid.advanceDay(); // dia 1: ainda imatura
    expect(grid.isMatureTree({ x: 1, y: 1 })).toBe(false);
    grid.advanceDay(); // dia 2: madura
    expect(grid.isMatureTree({ x: 1, y: 1 })).toBe(true);
    expect(grid.shadeLevelAt({ x: 0, y: 0 })).toBe(1);
  });

  it('nativa semeada já madura (ageDays = maturidade) gera sombra de cara', () => {
    const grid = new ShadeGrid(3, 3, 10);
    grid.plantTree({ x: 1, y: 1 }, 10); // semeada madura
    expect(grid.isMatureTree({ x: 1, y: 1 })).toBe(true);
    expect(grid.shadeLevelAt({ x: 0, y: 0 })).toBe(1);
  });
});

describe('ShadeGrid — Nível de Sombra', () => {
  it('classifica sol pleno / ideal / mata fechada', () => {
    const grid = new ShadeGrid(5, 5);
    // tile central (2,2): sol pleno sem árvores
    expect(grid.shadeStatusAt({ x: 2, y: 2 })).toBe('sol_pleno');

    matureTreeAt(grid, 1, 2); // 1 árvore madura vizinha => ideal
    expect(grid.shadeLevelAt({ x: 2, y: 2 })).toBe(1);
    expect(grid.shadeStatusAt({ x: 2, y: 2 })).toBe('ideal');

    matureTreeAt(grid, 3, 2); // 2ª árvore vizinha => mata fechada (nível 2)
    expect(grid.shadeLevelAt({ x: 2, y: 2 })).toBe(2);
    expect(grid.shadeStatusAt({ x: 2, y: 2 })).toBe('mata_fechada');
  });

  it('duas árvores influenciando o mesmo tile => nível 2', () => {
    const grid = new ShadeGrid(5, 5);
    matureTreeAt(grid, 1, 1);
    matureTreeAt(grid, 3, 3);
    // (2,2) é vizinho de ambas
    expect(grid.shadeLevelAt({ x: 2, y: 2 })).toBe(2);
  });

  it('o cacaueiro não influencia o nível de sombra', () => {
    const grid = new ShadeGrid(3, 3);
    grid.plantCacao({ x: 1, y: 1 });
    grid.advanceDay();
    grid.advanceDay();
    expect(grid.shadeLevelAt({ x: 0, y: 0 })).toBe(0);
  });

  it('recalcula ao remover uma árvore', () => {
    const grid = new ShadeGrid(3, 3);
    matureTreeAt(grid, 1, 1);
    expect(grid.shadeLevelAt({ x: 0, y: 0 })).toBe(1);
    grid.remove({ x: 1, y: 1 });
    expect(grid.shadeLevelAt({ x: 0, y: 0 })).toBe(0);
  });
});
