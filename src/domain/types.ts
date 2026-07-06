// Tipos compartilhados do núcleo de domínio.
// Regra de ouro: NENHUM arquivo em src/domain importa Phaser.
// O domínio é puro, determinístico e testável isoladamente.

export interface Coord {
  readonly x: number;
  readonly y: number;
}

export function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
}

export function coordsEqual(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Vizinhança de Moore (8 vizinhos) usada no cálculo de sombra. */
export const MOORE_NEIGHBORS: ReadonlyArray<Coord> = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 },                   { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
];
