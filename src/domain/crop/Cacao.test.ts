import { describe, it, expect } from 'vitest';
import { Cacao, SOL_PLENO_DEATH_DAYS } from './Cacao';

const IDEAL = 1;
const MATA_FECHADA = 2;
const SOL_PLENO = 0;

describe('Cacao — morte por Sol Pleno', () => {
  it('morre após 3 dias consecutivos em sol pleno', () => {
    const c = new Cacao();
    for (let i = 0; i < SOL_PLENO_DEATH_DAYS - 1; i++) {
      c.advanceDay(SOL_PLENO);
      expect(c.dead).toBe(false);
    }
    c.advanceDay(SOL_PLENO);
    expect(c.dead).toBe(true);
  });

  it('não morre se o estresse for interrompido por um dia ideal', () => {
    const c = new Cacao();
    c.advanceDay(SOL_PLENO);
    c.advanceDay(SOL_PLENO);
    c.advanceDay(IDEAL); // reseta o contador de sol pleno
    c.advanceDay(SOL_PLENO);
    c.advanceDay(SOL_PLENO);
    expect(c.dead).toBe(false);
  });
});

describe('Cacao — crescimento', () => {
  it('cresce em ritmo normal sob sombra ideal', () => {
    const c = new Cacao(2); // 2 dias por estágio
    expect(c.stage).toBe('muda');
    c.advanceDay(IDEAL);
    c.advanceDay(IDEAL);
    expect(c.stage).toBe('jovem');
  });

  it('não progride durante o sol pleno', () => {
    const c = new Cacao(2);
    c.advanceDay(SOL_PLENO);
    expect(c.stage).toBe('muda');
    expect(c.snapshot().progress).toBe(0);
  });

  it('mata fechada deixa o estágio 1 dia mais lento', () => {
    const ideal = new Cacao(2);
    ideal.advanceDay(IDEAL);
    ideal.advanceDay(IDEAL);
    expect(ideal.stage).toBe('jovem'); // 2 dias no ideal

    const shaded = new Cacao(2);
    shaded.advanceDay(MATA_FECHADA);
    shaded.advanceDay(MATA_FECHADA);
    expect(shaded.stage).toBe('muda'); // ainda não: precisa de 3 dias
    shaded.advanceDay(MATA_FECHADA);
    expect(shaded.stage).toBe('jovem');
  });

  it('chega a maduro e fica colhível', () => {
    const c = new Cacao(1); // 1 dia por estágio, 3 estágios até maduro
    c.advanceDay(IDEAL);
    c.advanceDay(IDEAL);
    c.advanceDay(IDEAL);
    expect(c.stage).toBe('maduro');
    expect(c.harvestable).toBe(true);
  });

  it('não avança além de maduro', () => {
    const c = new Cacao(1);
    for (let i = 0; i < 10; i++) c.advanceDay(IDEAL);
    expect(c.stage).toBe('maduro');
    expect(c.harvestable).toBe(true);
  });
});
