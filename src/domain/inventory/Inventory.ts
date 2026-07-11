/**
 * Inventário baseado em slots (rascunhos_iniciais.md).
 *  - Cada slot armazena apenas 1 tipo de item.
 *  - Itens do mesmo tipo empilham no mesmo slot (stack).
 *  - Se não houver slot disponível, o item não pode ser coletado.
 *
 * `maxStack` é opcional; por padrão o stack é ilimitado. Quando definido,
 * um mesmo tipo pode ocupar mais de um slot ao exceder o limite.
 */

export type ItemId = string;

export interface Slot {
  readonly itemId: ItemId;
  readonly qty: number;
}

export const DEFAULT_SLOT_COUNT = 10;

/** Estado do inventário p/ save. */
export interface InventoryState {
  readonly slotCount: number;
  /** `null` = ilimitado (Infinity não sobrevive a JSON). */
  readonly maxStack: number | null;
  readonly slots: ReadonlyArray<Slot | null>;
}

export class Inventory {
  private readonly slotsArr: Array<{ itemId: ItemId; qty: number } | null>;

  constructor(
    public readonly slotCount: number = DEFAULT_SLOT_COUNT,
    public readonly maxStack: number = Infinity,
  ) {
    if (slotCount <= 0) throw new Error('Inventory: slotCount deve ser > 0');
    if (maxStack <= 0) throw new Error('Inventory: maxStack deve ser > 0');
    this.slotsArr = new Array(slotCount).fill(null);
  }

  /**
   * Adiciona `qty` itens. Preenche stacks existentes (respeitando maxStack)
   * e depois cria novos slots enquanto houver espaço.
   * Retorna a quantidade EFETIVAMENTE adicionada (pode ser < qty se lotar).
   */
  add(itemId: ItemId, qty = 1): number {
    if (qty <= 0) return 0;
    let remaining = qty;

    // 1) completa stacks existentes do mesmo tipo
    for (const slot of this.slotsArr) {
      if (remaining === 0) break;
      if (slot && slot.itemId === itemId && slot.qty < this.maxStack) {
        const room = this.maxStack - slot.qty;
        const put = Math.min(room, remaining);
        slot.qty += put;
        remaining -= put;
      }
    }

    // 2) ocupa slots vazios
    for (let i = 0; i < this.slotsArr.length && remaining > 0; i++) {
      if (this.slotsArr[i] === null) {
        const put = Math.min(this.maxStack, remaining);
        this.slotsArr[i] = { itemId, qty: put };
        remaining -= put;
      }
    }

    return qty - remaining;
  }

  /** Remove até `qty` itens. Retorna quanto foi removido. */
  remove(itemId: ItemId, qty = 1): number {
    if (qty <= 0) return 0;
    let remaining = qty;
    for (let i = 0; i < this.slotsArr.length && remaining > 0; i++) {
      const slot = this.slotsArr[i];
      if (slot && slot.itemId === itemId) {
        const take = Math.min(slot.qty, remaining);
        slot.qty -= take;
        remaining -= take;
        if (slot.qty === 0) this.slotsArr[i] = null;
      }
    }
    return qty - remaining;
  }

  count(itemId: ItemId): number {
    return this.slotsArr.reduce(
      (sum, s) => (s && s.itemId === itemId ? sum + s.qty : sum),
      0,
    );
  }

  /** Verifica se cabe `qty` sem alterar o estado. */
  canAdd(itemId: ItemId, qty = 1): boolean {
    let capacity = 0;
    for (const slot of this.slotsArr) {
      if (slot === null) capacity += this.maxStack;
      else if (slot.itemId === itemId) capacity += this.maxStack - slot.qty;
    }
    return capacity >= qty;
  }

  get usedSlots(): number {
    return this.slotsArr.filter((s) => s !== null).length;
  }

  get freeSlots(): number {
    return this.slotCount - this.usedSlots;
  }

  slots(): ReadonlyArray<Slot | null> {
    return this.slotsArr.map((s) => (s ? { itemId: s.itemId, qty: s.qty } : null));
  }

  toState(): InventoryState {
    return {
      slotCount: this.slotCount,
      maxStack: Number.isFinite(this.maxStack) ? this.maxStack : null,
      slots: this.slots(),
    };
  }

  static fromState(s: InventoryState): Inventory {
    const maxStack = typeof s.maxStack === 'number' && Number.isFinite(s.maxStack) ? s.maxStack : Infinity;
    const inv = new Inventory(s.slotCount, maxStack);
    s.slots.forEach((slot, i) => {
      if (slot && i < inv.slotsArr.length) inv.slotsArr[i] = { itemId: slot.itemId, qty: slot.qty };
    });
    return inv;
  }
}
