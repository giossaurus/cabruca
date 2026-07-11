import Phaser from 'phaser';
import { TILE, TextureKey } from '../assets';
import { FOREST_FLAT_KEYS, FOREST_PROP_KEYS } from '../forest';
import { GRID_DEBUG } from '../debug';
import { UI } from '../ui';
import { DEPTH } from '../depths';
import { GRID_OX, GRID_OY, WORLD_H, WORLD_W, insidePlot, type PlotRect } from './geometry';

/**
 * Construção do cenário estático da fazenda — camada ADAPTER, extraída da
 * FarmScene. Terreno, casa, banca e decoração são puramente visuais + colisão;
 * nenhuma regra de jogo mora aqui (ADR 0002).
 */

export interface FarmWorld {
  /** Retângulos sólidos (casa, banca, decoração volumosa). O Player colide com eles. */
  readonly obstacles: Phaser.Geom.Rectangle[];
  /** Pisar aqui (porta da casa) permite dormir/encerrar o dia. */
  readonly doorZone: Phaser.Geom.Rectangle;
  /** Aproximar-se daqui (banca) permite abrir o menu de vendas. */
  readonly saleZone: Phaser.Geom.Rectangle;
}

/** Gerador determinístico (LCG) → mesmo cenário todo restart. */
function makeRng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

/** Faixas reservadas ao redor da porta e da banca — decoração não nasce nelas. */
function reservedZones(doorZone: Phaser.Geom.Rectangle, saleZone: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle[] {
  return [
    new Phaser.Geom.Rectangle(doorZone.x - 190, doorZone.y - 140, doorZone.width + 380, 330),
    new Phaser.Geom.Rectangle(saleZone.x - 130, saleZone.y - 120, saleZone.width + 260, 250),
  ];
}

/**
 * Monta o cenário na ordem original do create() da cena (a ordem de add importa
 * dentro do mesmo depth): grama → talhão → casa → banca → decoração → detalhes.
 */
export function buildFarmWorld(scene: Phaser.Scene, plot: PlotRect): FarmWorld {
  const obstacles: Phaser.Geom.Rectangle[] = [];
  drawGrassBackground(scene, plot);
  drawPlantableGround(scene, plot);
  const doorZone = buildHouse(scene, plot, obstacles);
  const saleZone = buildMarketStand(scene, plot, obstacles);
  const reserved = reservedZones(doorZone, saleZone);
  buildDecorations(scene, plot, obstacles, reserved);
  scatterForestDetails(scene, plot, reserved);
  return { obstacles, doorZone, saleZone };
}

function drawGrassBackground(scene: Phaser.Scene, plot: PlotRect): void {
  // Grama do pack (tile 16px) cobrindo TODO o MUNDO, ladrilhada em passos de
  // TILE (upscale ×4, nearest-neighbor via pixelArt) — nítida e sem borda.
  const bg = scene.add.container(0, 0).setDepth(-22);
  const cols = Math.ceil(WORLD_W / TILE);
  const rows = Math.ceil(WORLD_H / TILE);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      bg.add(
        scene.add.image(x * TILE, y * TILE, TextureKey.Grass).setOrigin(0, 0).setDisplaySize(TILE, TILE),
      );
    }
  }
  // Contorno sutil do talhão jogável — parte da visualização da grade de
  // sombra (só QA, ver GRID_DEBUG); invisível no gameplay normal.
  if (GRID_DEBUG) {
    const w = plot.cols * TILE;
    const h = plot.rows * TILE;
    scene.add.rectangle(GRID_OX + w / 2, GRID_OY + h / 2, w, h)
      .setStrokeStyle(2, 0x2a5d34, 0.5).setDepth(-19);
  }
}

/** Tiles plantáveis do talhão: visíveis, mas sem colisão. */
function drawPlantableGround(scene: Phaser.Scene, plot: PlotRect): void {
  const layer = scene.add.container(0, 0).setDepth(-18);
  for (let y = 0; y < plot.rows; y++) {
    for (let x = 0; x < plot.cols; x++) {
      const px = GRID_OX + x * TILE;
      const py = GRID_OY + y * TILE;
      const tile = scene.add.image(px, py, TextureKey.Bed)
        .setOrigin(0, 0)
        .setDisplaySize(TILE, TILE)
        .setAlpha(0.34)
        .setTint(0xb6965d);
      layer.add(tile);
    }
  }
}

/**
 * Casa ao norte/nordeste do talhão. Corpo sólido (colisão) + uma "porta" na
 * base: estando nela, E/Espaço/Z dispara a transição de dia. Depth pela base
 * → o jogador passa na frente/atrás corretamente.
 */
function buildHouse(scene: Phaser.Scene, plot: PlotRect, obstacles: Phaser.Geom.Rectangle[]): Phaser.Geom.Rectangle {
  const src = scene.textures.get(TextureKey.CottageClosed).getSourceImage();
  const dispH = 300;
  const dispW = dispH * (src.width / src.height);
  const baseX = GRID_OX + plot.cols * TILE * 0.72; // nordeste do talhão
  const baseY = GRID_OY - 210; // ao norte, com folga entre casa e talhão

  const g = scene.add.graphics().setDepth(baseY - 2);
  g.fillStyle(0x07110a, 0.24).fillEllipse(baseX, baseY - 8, dispW * 0.72, 42);
  g.fillStyle(0x9b6b3f, 0.75).fillRoundedRect(baseX - 36, baseY - 76, 72, 92, 8);

  scene.add.image(baseX, baseY, TextureKey.CottageClosed)
    .setOrigin(0.5, 1)
    .setDisplaySize(dispW, dispH)
    .setDepth(baseY);

  for (let y = baseY + 8; y < GRID_OY + 10; y += TILE) {
    scene.add.image(baseX, y, TextureKey.Bed).setOrigin(0.5, 0.5).setDisplaySize(TILE, TILE * 0.62).setDepth(-14);
  }
  scene.add.image(baseX - dispW * 0.36, baseY - 6, TextureKey.DecorBush).setOrigin(0.5, 1).setScale(2.6).setDepth(baseY + 1);
  scene.add.image(baseX + dispW * 0.34, baseY - 6, TextureKey.DecorFlower).setOrigin(0.5, 1).setScale(3.2).setDepth(baseY + 1);

  // Corpo sólido: cobre paredes/telhado, deixando a base (porta + chão) livre.
  obstacles.push(new Phaser.Geom.Rectangle(
    baseX - dispW * 0.44, baseY - dispH * 0.86, dispW * 0.88, dispH * 0.62,
  ));
  // Porta: faixa estreita na base-central; pisar aqui entra na casa.
  return new Phaser.Geom.Rectangle(baseX - 36, baseY - dispH * 0.24, 72, dispH * 0.24 + 10);
}

/** Banca física de venda: aproxima, aperta E/V e abre o menu de vendas. */
function buildMarketStand(scene: Phaser.Scene, _plot: PlotRect, obstacles: Phaser.Geom.Rectangle[]): Phaser.Geom.Rectangle {
  const baseX = GRID_OX + 112;
  const baseY = GRID_OY - 28;
  const standW = 118;
  const standH = 118;

  // Só uma sombra suave no chão (sem bloco de "terra" retangular, que criava
  // uma borda dura sobrepondo a grama/talhão).
  const g = scene.add.graphics().setDepth(baseY - 3);
  g.fillStyle(0x07110a, 0.22).fillEllipse(baseX, baseY - 8, standW * 0.82, 26);
  scene.add.image(baseX, baseY, TextureKey.MarketStand)
    .setOrigin(0.5, 1)
    .setDisplaySize(standW, standH)
    .setDepth(baseY);
  scene.add.text(baseX, baseY - standH + 6, 'VENDA', {
    fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.primary,
    backgroundColor: '#5d3a22',
  }).setOrigin(0.5).setPadding(4, 2, 4, 2).setDepth(baseY + 1);

  obstacles.push(new Phaser.Geom.Rectangle(baseX - 48, baseY - 76, 96, 58));
  return new Phaser.Geom.Rectangle(baseX - 58, baseY - 20, 116, 70);
}

/**
 * Decoração de ambiente (pedras, arbustos, flores) espalhada pelo MUNDO, fora
 * do talhão, dando o que revelar ao explorar. Puramente cosmética. Posições
 * fixas (pseudo-aleatórias por semente) para leitura estável entre sessões.
 */
function buildDecorations(
  scene: Phaser.Scene,
  plot: PlotRect,
  obstacles: Phaser.Geom.Rectangle[],
  reserved: readonly Phaser.Geom.Rectangle[],
): void {
  const keys = [TextureKey.DecorBush, TextureKey.DecorStone, TextureKey.DecorFlower];
  const rnd = makeRng(1337);
  for (let i = 0; i < 90; i++) {
    const x = 40 + rnd() * (WORLD_W - 80);
    const y = 60 + rnd() * (WORLD_H - 100);
    if (insidePlot(plot, x, y, 40)) continue; // não polui a área jogável
    const key = keys[Math.floor(rnd() * keys.length)]!;
    const scale = key === TextureKey.DecorFlower ? 2.6 + rnd() * 1.2 : 3 + rnd() * 1.4;
    const hitW = key === TextureKey.DecorBush ? 22 * scale : 18 * scale;
    const hitH = key === TextureKey.DecorBush ? 10 * scale : 9 * scale;
    const hit = new Phaser.Geom.Rectangle(x - hitW / 2, y - hitH, hitW, hitH);
    if (reserved.some((r) => Phaser.Geom.Rectangle.Overlaps(hit, r))) continue;
    if (key !== TextureKey.DecorFlower && obstacles.some((o) => Phaser.Geom.Rectangle.Overlaps(hit, o))) continue;
    // Flores são rasteiras (depth baixo fixo, sob o jogador); arbustos e pedras
    // são volumes e ordenam por Y com o jogador (base em y por causa do origin 1).
    const depth = key === TextureKey.DecorFlower ? -15 : Math.min(Math.round(y), DEPTH.fog - 10);
    scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth);
    if (key !== TextureKey.DecorFlower) obstacles.push(hit);
  }
}

/**
 * Detalhes de chão de floresta (Pocket Cozy Pixels) espalhados FORA do talhão:
 * manchas deitadas (FLAT, sob a decoração) e volumes em pé (PROP, ordenados por
 * Y com o jogador). Puramente cosmético, sem colisão. Semente própria para não
 * repetir as posições do decor; determinístico entre sessões.
 */
function scatterForestDetails(
  scene: Phaser.Scene,
  plot: PlotRect,
  reserved: readonly Phaser.Geom.Rectangle[],
): void {
  const blocked = (r: Phaser.Geom.Rectangle): boolean =>
    reserved.some((z) => Phaser.Geom.Rectangle.Overlaps(r, z));

  const rnd = makeRng(90210);
  const pick = (arr: readonly string[]): string => arr[Math.floor(rnd() * arr.length)]!;

  const place = (key: string, flat: boolean): void => {
    const x = 30 + rnd() * (WORLD_W - 60);
    const y = 50 + rnd() * (WORLD_H - 80);
    // Buffer maior que o decor (48 vs 40): nada encostando nos tiles de cacau.
    if (insidePlot(plot, x, y, 48)) return;
    const src = scene.textures.get(key).getSourceImage();
    const targetH = flat ? 52 + rnd() * 28 : 40 + rnd() * 30;
    const s = targetH / src.height;
    const w = src.width * s;
    if (flat) {
      if (blocked(new Phaser.Geom.Rectangle(x - w / 2, y - targetH / 2, w, targetH))) return;
      scene.add.image(x, y, key).setOrigin(0.5, 0.5).setScale(s).setDepth(-18).setAlpha(0.92);
    } else {
      if (blocked(new Phaser.Geom.Rectangle(x - w / 2, y - targetH, w, targetH))) return;
      // Ordena com o jogador, mas sempre sob o fog (DEPTH.fog = 1400).
      scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(s).setDepth(Math.min(Math.round(y), DEPTH.fog - 10));
    }
  };

  for (let i = 0; i < 30; i++) place(pick(FOREST_FLAT_KEYS), true);
  for (let i = 0; i < 64; i++) place(pick(FOREST_PROP_KEYS), false);
}

/** Diâmetro do "pincel" que apaga a névoa ao redor do jogador (raio ~150px). */
const FOG_BRUSH = 300;

/** Névoa cobrindo o mundo; o explorado é apagado (permanente). */
export class FogOfWar {
  private readonly fog: Phaser.GameObjects.RenderTexture;

  constructor(scene: Phaser.Scene) {
    makeFogBrush(scene);
    this.fog = scene.add.renderTexture(0, 0, WORLD_W, WORLD_H).setOrigin(0, 0).setDepth(DEPTH.fog);
    this.fog.fill(0x0b130e, 1);
  }

  /** Apaga a névoa (mundo-coords) centrando o pincel em (x,y). */
  reveal(x: number, y: number): void {
    this.fog.erase('fog_brush', x - FOG_BRUSH / 2, y - FOG_BRUSH / 2);
  }

  /** Revela o talhão + arredores de início (senão o jogador nasce "no escuro"). */
  revealPlotStart(plot: PlotRect): void {
    const cx = GRID_OX + (plot.cols * TILE) / 2;
    const cy = GRID_OY + (plot.rows * TILE) / 2;
    const halfW = (plot.cols * TILE) / 2 + 130;
    const halfH = (plot.rows * TILE) / 2 + 130;
    for (let y = cy - halfH; y <= cy + halfH; y += 90) {
      for (let x = cx - halfW; x <= cx + halfW; x += 90) this.reveal(x, y);
    }
  }
}

/** Pincel radial suave (opaco no centro, some na borda) gerado uma vez. */
function makeFogBrush(scene: Phaser.Scene): void {
  if (scene.textures.exists('fog_brush')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const steps = 44;
  for (let i = 0; i < steps; i++) {
    const r = (FOG_BRUSH / 2) * (1 - i / steps);
    g.fillStyle(0xffffff, 0.07).fillCircle(FOG_BRUSH / 2, FOG_BRUSH / 2, r);
  }
  g.generateTexture('fog_brush', FOG_BRUSH, FOG_BRUSH);
  g.destroy();
}
