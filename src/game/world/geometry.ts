import Phaser from 'phaser';
import { PLAYER_W, TILE } from '../assets';

/**
 * Geometria compartilhada do mundo — camada ADAPTER. Fonte única das medidas do
 * mundo/talhão e dos retângulos de colisão usados por FarmScene, Player e Dog
 * (antes duplicados nos três, com risco de divergirem).
 */

/** Talhão jogável (grade do domínio) em coordenadas de tile/pixel. */
export interface PlotRect {
  readonly ox: number;
  readonly oy: number;
  readonly cols: number;
  readonly rows: number;
}

/** Retângulo de mundo em pixels (limites de caminhada). */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Dir {
  readonly x: number;
  readonly y: number;
}

// Mundo maior que a tela (960×640): a câmera segue o jogador e o mapa vai sendo
// revelado (fog). O talhão 13×8 (13*64=832 × 8*64=512) fica centralizado na
// horizontal e na metade inferior, deixando o norte para a casa e o cenário.
export const WORLD_W = 1920;
export const WORLD_H = 1408;
export const GRID_OX = Math.round((WORLD_W - 13 * 64) / 2); // 544
export const GRID_OY = 768; // espaço ao norte para casa/cenário

/** Caixa de "pés" para colisão (jogador): baixa, rente ao chão. */
export const FOOT_H = 14;

/** True se (x,y) cai no talhão expandido por `buffer` px em toda a volta. */
export function insidePlot(plot: PlotRect, x: number, y: number, buffer: number): boolean {
  return (
    x > plot.ox - buffer && x < plot.ox + plot.cols * TILE + buffer &&
    y > plot.oy - buffer && y < plot.oy + plot.rows * TILE + buffer
  );
}

/**
 * Tronco/base de uma árvore nativa no tile `c` — o que bloqueia o jogador (a
 * copa é passável). Madura tem tronco maior que muda.
 */
export function treeTrunkRect(plot: PlotRect, c: { x: number; y: number }, mature: boolean): Phaser.Geom.Rectangle {
  const trunkW = mature ? 28 : 18;
  const trunkH = mature ? 22 : 12;
  return new Phaser.Geom.Rectangle(
    plot.ox + c.x * TILE + TILE / 2 - trunkW / 2,
    plot.oy + c.y * TILE + TILE - trunkH,
    trunkW,
    trunkH,
  );
}

/** Caixa dos pés do jogador com centro/pés em (x, y). */
export function footRect(x: number, y: number): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(x - PLAYER_W / 2, y - FOOT_H, PLAYER_W, FOOT_H);
}
