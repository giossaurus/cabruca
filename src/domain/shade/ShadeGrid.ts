import { type Coord, coordKey, MOORE_NEIGHBORS } from '../types';

/** Dias até uma árvore nativa amadurecer e passar a gerar sombra (default). */
export const TREE_MATURITY_DAYS = 10;

export type Tile =
  | { readonly kind: 'empty' }
  | { readonly kind: 'tree'; readonly ageDays: number; readonly pruned?: boolean }
  | { readonly kind: 'cacao' };

const EMPTY: Tile = { kind: 'empty' };

export type ShadeStatus = 'sol_pleno' | 'ideal' | 'mata_fechada';

/**
 * Grade da fazenda responsável APENAS pela ocupação de tiles e pelo
 * cálculo do Nível de Sombra.
 *
 * Regras (rascunhos_iniciais.md):
 *  - Sombra é gerada só por árvores NATIVAS MADURAS (ageDays >= 2).
 *  - Cada árvore madura soma +1 ao Nível de Sombra dos 8 vizinhos (Moore).
 *  - Duas árvores influenciando o mesmo tile => nível 2.
 *  - O cacaueiro NÃO gera sombra.
 *  - Nível 0 = Sol Pleno, 1 = Ideal, 2+ = Mata Fechada.
 */
export class ShadeGrid {
  private readonly tiles: Map<string, Tile> = new Map();

  constructor(
    public readonly width: number,
    public readonly height: number,
    /** Dias até uma nativa amadurecer. Tunável (ver balance.ts). */
    public readonly maturityDays: number = TREE_MATURITY_DAYS,
  ) {
    if (width <= 0 || height <= 0) {
      throw new Error('ShadeGrid: width e height devem ser > 0');
    }
  }

  inBounds(c: Coord): boolean {
    return c.x >= 0 && c.y >= 0 && c.x < this.width && c.y < this.height;
  }

  tileAt(c: Coord): Tile {
    this.assertInBounds(c);
    return this.tiles.get(coordKey(c)) ?? EMPTY;
  }

  isEmpty(c: Coord): boolean {
    return this.tileAt(c).kind === 'empty';
  }

  /**
   * Planta uma árvore nativa. Recém-plantada (ageDays 0) não gera sombra.
   * `ageDays` permite semear nativas já maduras no início da partida.
   */
  plantTree(c: Coord, ageDays = 0): void {
    this.assertPlantable(c);
    this.tiles.set(coordKey(c), { kind: 'tree', ageDays });
  }

  /** Planta um cacaueiro. Ocupa o tile mas não gera sombra. */
  plantCacao(c: Coord): void {
    this.assertPlantable(c);
    this.tiles.set(coordKey(c), { kind: 'cacao' });
  }

  remove(c: Coord): void {
    this.assertInBounds(c);
    this.tiles.delete(coordKey(c));
  }

  /** Uma árvore é madura quando atingiu `maturityDays` de idade. */
  isMatureTree(c: Coord): boolean {
    const t = this.tileAt(c);
    return t.kind === 'tree' && t.ageDays >= this.maturityDays;
  }

  /** Árvore podada: continua existindo (bloqueia/ocupa) mas não gera sombra. */
  isPrunedTree(c: Coord): boolean {
    const t = this.tileAt(c);
    return t.kind === 'tree' && t.pruned === true;
  }

  /**
   * Poda uma árvore: marca como podada (não gera mais sombra). A árvore
   * permanece no tile. Não valida maturidade — quem decide é o `Farm`.
   */
  prune(c: Coord): void {
    this.assertInBounds(c);
    const t = this.tileAt(c);
    if (t.kind !== 'tree') {
      throw new Error(`ShadeGrid: não há árvore para podar em (${c.x},${c.y})`);
    }
    this.tiles.set(coordKey(c), { kind: 'tree', ageDays: t.ageDays, pruned: true });
  }

  /** Avança um dia: envelhece todas as árvores nativas (preservando a poda). */
  advanceDay(): void {
    for (const [key, tile] of this.tiles) {
      if (tile.kind === 'tree') {
        this.tiles.set(key, {
          kind: 'tree',
          ageDays: tile.ageDays + 1,
          ...(tile.pruned ? { pruned: true } : {}),
        });
      }
    }
  }

  /**
   * Nível de Sombra bruto = nº de árvores nativas maduras E NÃO PODADAS nos 8
   * vizinhos. Árvore podada continua existindo, mas deixa de gerar sombra.
   */
  shadeLevelAt(c: Coord): number {
    this.assertInBounds(c);
    let level = 0;
    for (const d of MOORE_NEIGHBORS) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      if (this.inBounds(n) && this.isMatureTree(n) && !this.isPrunedTree(n)) level++;
    }
    return level;
  }

  shadeStatusAt(c: Coord): ShadeStatus {
    const level = this.shadeLevelAt(c);
    if (level === 0) return 'sol_pleno';
    if (level === 1) return 'ideal';
    return 'mata_fechada';
  }

  private assertInBounds(c: Coord): void {
    if (!this.inBounds(c)) {
      throw new Error(`ShadeGrid: coordenada fora dos limites (${c.x},${c.y})`);
    }
  }

  private assertPlantable(c: Coord): void {
    this.assertInBounds(c);
    if (!this.isEmpty(c)) {
      throw new Error(`ShadeGrid: tile (${c.x},${c.y}) já está ocupado`);
    }
  }
}
