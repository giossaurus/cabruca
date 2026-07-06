import { describe, it, expect } from 'vitest';
import { Inventory } from './Inventory';

describe('Inventory — stacking', () => {
  it('empilha itens do mesmo tipo no mesmo slot', () => {
    const inv = new Inventory(10);
    inv.add('cacau', 3);
    inv.add('cacau', 2);
    expect(inv.count('cacau')).toBe(5);
    expect(inv.usedSlots).toBe(1);
  });

  it('usa slots distintos para tipos diferentes', () => {
    const inv = new Inventory(10);
    inv.add('cacau', 1);
    inv.add('madeira', 1);
    inv.add('mel', 1);
    expect(inv.usedSlots).toBe(3);
  });
});

describe('Inventory — limite de slots', () => {
  it('não coleta quando não há slot disponível', () => {
    const inv = new Inventory(2);
    inv.add('cacau', 1);
    inv.add('madeira', 1);
    // sem slot livre e tipo novo => rejeitado
    const added = inv.add('mel', 1);
    expect(added).toBe(0);
    expect(inv.count('mel')).toBe(0);
    expect(inv.canAdd('mel', 1)).toBe(false);
  });

  it('ainda empilha em tipo existente mesmo com todos os slots ocupados', () => {
    const inv = new Inventory(1);
    inv.add('cacau', 1);
    const added = inv.add('cacau', 4);
    expect(added).toBe(4);
    expect(inv.count('cacau')).toBe(5);
  });
});

describe('Inventory — maxStack', () => {
  it('transborda para um novo slot ao exceder o maxStack', () => {
    const inv = new Inventory(10, 64);
    const added = inv.add('cacau', 100);
    expect(added).toBe(100);
    expect(inv.usedSlots).toBe(2); // 64 + 36
  });

  it('respeita a capacidade total ao lotar', () => {
    const inv = new Inventory(2, 10);
    const added = inv.add('cacau', 25); // cap total = 20
    expect(added).toBe(20);
    expect(inv.count('cacau')).toBe(20);
  });
});

describe('Inventory — remoção', () => {
  it('remove e libera o slot ao zerar', () => {
    const inv = new Inventory(10);
    inv.add('cacau', 3);
    const removed = inv.remove('cacau', 3);
    expect(removed).toBe(3);
    expect(inv.usedSlots).toBe(0);
  });

  it('remove no máximo o disponível', () => {
    const inv = new Inventory(10);
    inv.add('cacau', 2);
    expect(inv.remove('cacau', 5)).toBe(2);
    expect(inv.count('cacau')).toBe(0);
  });
});
