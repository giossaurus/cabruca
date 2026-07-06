import { describe, it, expect } from 'vitest';
import { Indicators } from './Indicators';

describe('Indicators', () => {
  it('começa com 50 em cada indicador', () => {
    const ind = new Indicators();
    expect(ind.snapshot()).toEqual({
      biodiversidade: 50,
      economia: 50,
      comunidade: 50,
    });
  });

  it('aplica deltas positivos e negativos', () => {
    const ind = new Indicators();
    ind.apply({ economia: +10, biodiversidade: -5 });
    expect(ind.get('economia')).toBe(60);
    expect(ind.get('biodiversidade')).toBe(45);
    expect(ind.get('comunidade')).toBe(50); // inalterado
  });

  it('faz clamp em [0, 100]', () => {
    const ind = new Indicators();
    ind.apply({ economia: +999 });
    ind.apply({ biodiversidade: -999 });
    expect(ind.get('economia')).toBe(100);
    expect(ind.get('biodiversidade')).toBe(0);
  });

  it('expõe métricas de equilíbrio', () => {
    const ind = new Indicators();
    ind.apply({ biodiversidade: +20, economia: -10 });
    // bio=70, eco=40, com=50
    expect(ind.min()).toBe(40);
    expect(ind.average()).toBeCloseTo(53.33, 1);
    expect(ind.allAbove(30)).toBe(true);
    expect(ind.allAbove(45)).toBe(false);
  });
});
