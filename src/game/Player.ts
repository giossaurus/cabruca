import Phaser from 'phaser';
import type { Farm } from '../domain';
import {
  TILE, TextureKey, PLAYER_W, PLAYER_FRAME_W, PLAYER_FRAME_H,
  playerAnim, type PlayerFacing,
} from './assets';

/**
 * Avatar do jogador — helper da camada ADAPTER (NÃO é domínio; movimento e
 * colisão são apresentação/input, cobertos por QA manual, ver ADR 0002).
 *
 * Sprite animado direcional (pack Farm Life): idle/walk para baixo, cima e lado
 * (esquerda = lado espelhado). Movimento livre em pixels (8 direções) por TODO o
 * MUNDO (não só o talhão) — a câmera segue o jogador e o mapa vai sendo revelado.
 * Colisões: bordas do mundo, árvores nativas maduras (só dentro do talhão) e
 * obstáculos fixos (ex.: a casa). Cacau e mudas são "pisáveis".
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

const SPEED = 160; // px/s
/** Altura de exibição do avatar (~1,5 tile); largura mantém o aspecto do frame. */
const DISPLAY_H = TILE * 1.5;
const DISPLAY_W = DISPLAY_H * (PLAYER_FRAME_W / PLAYER_FRAME_H);
/** Caixa de "pés" para colisão com obstáculos (ex.: casa). */
const FOOT_H = 14;

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private px: number; // centro/pés em pixels (mundo)
  private py: number;
  private facing: PlayerFacing = 'down';
  private curAnim = '';

  constructor(
    scene: Phaser.Scene,
    private readonly farm: Farm,
    private readonly plot: PlotRect,
    private readonly world: Bounds,
    private readonly obstacles: readonly Phaser.Geom.Rectangle[],
  ) {
    // Começa no centro do talhão.
    this.px = plot.ox + (plot.cols * TILE) / 2;
    this.py = plot.oy + (plot.rows * TILE) / 2;
    // Origem em (0.5, 0.92): os pés (~92% da altura do frame) ficam em (px,py)
    // → tile pisado. Exibido em ~1,5 tile de altura.
    this.sprite = scene.add
      .sprite(this.px, this.py, TextureKey.PlayerIdle, 0)
      .setDisplaySize(DISPLAY_W, DISPLAY_H)
      .setOrigin(0.5, 0.92);
    this.setAnim('idle');
  }

  get worldX(): number { return this.px; }
  get worldY(): number { return this.py; }

  /** True quando os pés estão dentro do talhão jogável. */
  get onPlot(): boolean {
    return (
      this.px >= this.plot.ox && this.px < this.plot.ox + this.plot.cols * TILE &&
      this.py >= this.plot.oy && this.py < this.plot.oy + this.plot.rows * TILE
    );
  }

  /** Tile sob os pés do jogador dentro do talhão (clamped; use com `onPlot`). */
  get tileCoord(): { x: number; y: number } {
    return {
      x: Phaser.Math.Clamp(Math.floor((this.px - this.plot.ox) / TILE), 0, this.plot.cols - 1),
      y: Phaser.Math.Clamp(Math.floor((this.py - this.plot.oy) / TILE), 0, this.plot.rows - 1),
    };
  }

  /** Teleporta o jogador (usado ao sair da casa após a transição de dia). */
  moveTo(x: number, y: number): void {
    this.px = x;
    this.py = y;
    this.sprite.setPosition(x, y).setDepth(y);
  }

  update(deltaMs: number, dir: Dir): void {
    let dx = dir.x;
    let dy = dir.y;
    if (dx === 0 && dy === 0) {
      this.setAnim('idle');
      return;
    }
    // Direção do sprite: horizontal domina (usa a linha "lado" espelhada);
    // senão, cima/baixo. Mantém a última direção olhada quando parado.
    if (dir.x !== 0) {
      this.facing = 'side';
      this.sprite.setFlipX(dir.x < 0);
    } else if (dir.y > 0) {
      this.facing = 'down';
    } else {
      this.facing = 'up';
    }
    this.setAnim('walk');

    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const dist = SPEED * (deltaMs / 1000);
    // movimento por eixo → deslizar ao longo de obstáculos.
    this.moveAxis(dx * dist, 0);
    this.moveAxis(0, dy * dist);
    this.sprite.setPosition(this.px, this.py);
    // profundidade por Y → parece "andar atrás/na frente" das plantas/casa.
    this.sprite.setDepth(this.py);
  }

  /** Troca a animação só quando muda (evita reiniciar o loop a cada frame). */
  private setAnim(kind: 'idle' | 'walk'): void {
    const key = playerAnim(kind, this.facing);
    if (key === this.curAnim) return;
    this.curAnim = key;
    this.sprite.play(key, true);
  }

  private moveAxis(mx: number, my: number): void {
    const cur = this.tileCoord;
    const nx = Phaser.Math.Clamp(
      this.px + mx,
      this.world.x + PLAYER_W / 2,
      this.world.x + this.world.w - PLAYER_W / 2,
    );
    const ny = Phaser.Math.Clamp(
      this.py + my,
      this.world.y + 4,
      this.world.y + this.world.h - 4,
    );
    // Colisão com obstáculos fixos (casa): caixa dos pés no destino.
    const foot = new Phaser.Geom.Rectangle(nx - PLAYER_W / 2, ny - FOOT_H, PLAYER_W, FOOT_H);
    for (const o of this.obstacles) {
      if (Phaser.Geom.Rectangle.Overlaps(foot, o)) return;
    }
    // Bloqueia ao ENTRAR num tile de árvore madura DIFERENTE do atual, apenas
    // se o destino cair dentro do talhão (fora dele não há árvores de domínio).
    const tx = Math.floor((nx - this.plot.ox) / TILE);
    const ty = Math.floor((ny - this.plot.oy) / TILE);
    const inPlot = tx >= 0 && tx < this.plot.cols && ty >= 0 && ty < this.plot.rows;
    const enteringNewTile = tx !== cur.x || ty !== cur.y;
    if (inPlot && enteringNewTile && this.farm.grid.isMatureTree({ x: tx, y: ty })) return;
    this.px = nx;
    this.py = ny;
  }
}
