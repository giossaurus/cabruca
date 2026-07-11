import Phaser from 'phaser';
import {
  TILE, TextureKey, DOG_FRAME_W, DOG_FRAME_H,
  DogWalkRow, DogIdleFrame, dogAnim, type DogFacing,
} from './assets';
import type { Bounds, PlotRect } from './Player';

/**
 * Cão de estimação (pack Goldie, por Artoellie) — helper da camada ADAPTER, puro
 * ambiente/vida, sem regra de domínio e sem colisão (o jogador é o "dono").
 *
 * IA leve por estados: fica alternando entre BRINCAR (vagar por pontos aleatórios
 * ao redor do dono, fora do talhão) e SEGUIR o dono; senta para descansar entre
 * um e outro. Se o dono se afasta demais, corre atrás. Sprite direcional
 * (baixo/cima/lado, lado espelhado como o jogador). Movimento não-determinístico
 * de propósito — dá sensação de bicho vivo.
 */

// ~0,7 tile de altura: um cão de porte médio fica em torno de metade do jogador
// (que tem ~1,5 tile), evitando um Goldie do tamanho de uma pessoa.
const DISPLAY_H = TILE * 0.7;
const DISPLAY_W = DISPLAY_H * (DOG_FRAME_W / DOG_FRAME_H);

const SPEED_PLAY = 92;   // px/s vagando
const SPEED_FOLLOW = 152; // px/s correndo atrás do dono (mais rápido)
const ARRIVE = 8;        // px até considerar que chegou no alvo
const FOLLOW_MAX = 340;  // dono além disso → segue obrigatoriamente
const FOLLOW_MIN = 96;   // ao seguir, para a essa distância do dono
const PLAY_RADIUS = 240; // raio de brincadeira ao redor do dono

type State = 'idle' | 'move';
type Mode = 'play' | 'follow';

export class Dog {
  readonly sprite: Phaser.GameObjects.Sprite;
  private px: number;
  private py: number;
  private tx = 0;
  private ty = 0;
  private state: State = 'idle';
  private mode: Mode = 'play';
  private facing: DogFacing = 'side';
  private idleTimer: number;
  private curAnim = '';

  constructor(
    scene: Phaser.Scene,
    private readonly world: Bounds,
    private readonly plot: PlotRect,
    startX: number,
    startY: number,
  ) {
    this.px = startX;
    this.py = startY;
    this.sprite = scene.add
      .sprite(startX, startY, TextureKey.Dog, DogIdleFrame.side)
      .setDisplaySize(DISPLAY_W, DISPLAY_H)
      .setOrigin(0.5, 0.9)
      .setDepth(startY);
    this.idleTimer = 300 + Math.random() * 800;
  }

  update(deltaMs: number, ownerX: number, ownerY: number): void {
    const distOwner = Math.hypot(ownerX - this.px, ownerY - this.py);
    // Dono longe demais: abandona o que estava fazendo e corre atrás.
    if (distOwner > FOLLOW_MAX) {
      this.mode = 'follow';
      this.state = 'move';
    }

    if (this.state === 'idle') {
      this.setIdleFrame();
      this.idleTimer -= deltaMs;
      if (this.idleTimer <= 0) this.decide(ownerX, ownerY);
      return;
    }

    // Seguindo: re-mira no dono a cada frame e para quando chega perto.
    if (this.mode === 'follow') {
      this.tx = ownerX;
      this.ty = ownerY;
      if (distOwner <= FOLLOW_MIN) {
        this.enterIdle();
        return;
      }
    }

    let dx = this.tx - this.px;
    let dy = this.ty - this.py;
    const d = Math.hypot(dx, dy);
    if (d <= ARRIVE) {
      this.enterIdle();
      return;
    }
    dx /= d;
    dy /= d;
    this.face(dx, dy);

    const speed = this.mode === 'follow' ? SPEED_FOLLOW : SPEED_PLAY;
    const step = speed * (deltaMs / 1000);
    this.px = Phaser.Math.Clamp(this.px + dx * step, this.world.x + 12, this.world.x + this.world.w - 12);
    this.py = Phaser.Math.Clamp(this.py + dy * step, this.world.y + 12, this.world.y + this.world.h - 12);
    this.sprite.setPosition(this.px, this.py).setDepth(this.py);
    this.setWalkAnim();
  }

  /** Escolhe o próximo objetivo ao terminar um trecho ou um descanso. */
  private decide(ownerX: number, ownerY: number): void {
    const distOwner = Math.hypot(ownerX - this.px, ownerY - this.py);
    const r = Math.random();
    if (distOwner > FOLLOW_MAX * 0.7 || r < 0.28) {
      this.mode = 'follow';
      this.state = 'move';
      this.tx = ownerX;
      this.ty = ownerY;
      return;
    }
    if (r < 0.74) {
      this.mode = 'play';
      this.state = 'move';
      const p = this.playPoint(ownerX, ownerY);
      this.tx = p.x;
      this.ty = p.y;
      return;
    }
    this.enterIdle();
  }

  /** Ponto de brincadeira ao redor do dono, evitando o talhão de cacau. */
  private playPoint(ownerX: number, ownerY: number): { x: number; y: number } {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 60 + Math.random() * PLAY_RADIUS;
      const x = Phaser.Math.Clamp(ownerX + Math.cos(a) * rad, this.world.x + 20, this.world.x + this.world.w - 20);
      const y = Phaser.Math.Clamp(ownerY + Math.sin(a) * rad, this.world.y + 20, this.world.y + this.world.h - 20);
      if (!this.insidePlot(x, y)) return { x, y };
    }
    return { x: ownerX, y: ownerY };
  }

  private insidePlot(x: number, y: number): boolean {
    return (
      x > this.plot.ox - 24 && x < this.plot.ox + this.plot.cols * TILE + 24 &&
      y > this.plot.oy - 24 && y < this.plot.oy + this.plot.rows * TILE + 24
    );
  }

  private enterIdle(): void {
    this.state = 'idle';
    this.idleTimer = 500 + Math.random() * 1800;
  }

  /** Direção do sprite: horizontal domina (lado espelhado); senão cima/baixo. */
  private face(dx: number, dy: number): void {
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facing = 'side';
      this.sprite.setFlipX(dx < 0); // sheet olha p/ DIREITA → espelha ao ir p/ esquerda
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }
  }

  private setWalkAnim(): void {
    const key = dogAnim(this.facing);
    if (key === this.curAnim) return;
    this.curAnim = key;
    this.sprite.play(key, true);
  }

  private setIdleFrame(): void {
    if (this.curAnim === 'idle') return;
    this.curAnim = 'idle';
    this.sprite.stop();
    this.sprite.setFrame(DogIdleFrame[this.facing]);
  }
}
