import Phaser from 'phaser';
import type { CacaoStage } from '../domain';

/**
 * Contrato de KEYS de textura do jogo. O render (FarmScene) só conhece estas
 * keys — nunca de onde a imagem veio.
 *
 * O visual agora vem do pack pixel-art **Farm Life** (16px, upscale ×4 via
 * `pixelArt:true` no main.ts), recortado em `src/assets/farm-life/`. O cacau
 * (cultura-identidade, que o pack não tem) segue desenhado por código em
 * `createPlaceholderTextures`. As keys abaixo são carregadas no BootScene.
 */
export const TextureKey = {
  // Chão / terreno (PNGs 16px do pack, ladrilhados ×4).
  Grass: 'grass',
  Bed: 'bed', // canteiro arado sob o cacau
  // Vegetação (imagens únicas recortadas do pack).
  TreeMature: 'tree_mature', // árvore nativa madura (dá sombra)
  Seedling: 'seedling', // muda recém-plantada
  DecorBush: 'decor_bush',
  DecorFlower: 'decor_flower',
  DecorStone: 'decor_stone',
  House: 'house', // casa ao norte (entrar = transição de dia)
  CottageClosed: 'cottage_closed',
  // Cacau (procedural — ver createPlaceholderTextures).
  CacaoMuda: 'cacao_muda',
  CacaoJovem: 'cacao_jovem',
  CacaoCrescendo: 'cacao_crescendo',
  CacaoMaduro: 'cacao_maduro',
  CacaoDead: 'cacao_dead',
  // Jogador (spritesheets direcionais do pack).
  PlayerIdle: 'player_idle',
  PlayerWalk: 'player_walk',
  // Cão de estimação (sheet direcional do pack Goldie).
  Dog: 'dog',
  // UI.
  MenuBackground: 'menu_background',
  MenuBackgroundSparseExtraLight: 'menu_background_sparse_extra_light',
  MenuBackgroundLargeLight: 'menu_background_large_light',
  MenuBackgroundLargeExtraLight: 'menu_background_large_extra_light',
  SleepBackgroundStarry: 'sleep_background_starry',
  ScienzaLogo: 'scienza_logo',
  IconCacao: 'icon_cacao',
  IconHarvest: 'icon_harvest',
  IconPrune: 'icon_prune',
  IconSell: 'icon_sell',
  MarketStand: 'market_stand',
} as const;

export const TILE = 64;

// ─── Jogador (spritesheets `character/idle.png` e `character/walk.png`) ───────
// Frame 80×112 (verificado visualmente). 3 LINHAS = direções; COLUNAS = frames.
// Linha 0 = baixo (de frente), 1 = lado (virado p/ direita), 2 = cima (de costas).
// Esquerda = lado espelhado (flipX) — não há linha própria.
export const PLAYER_FRAME_W = 80;
export const PLAYER_FRAME_H = 112;
export const PLAYER_IDLE_COLS = 2;
export const PLAYER_WALK_COLS = 8;

/** Linhas do sheet por direção "canônica" (esquerda reusa a de lado). */
export const PlayerRow = { down: 0, side: 1, up: 2 } as const;
export type PlayerFacing = 'down' | 'up' | 'side';

/** Nome da animação (ex.: `walk_down`). Criadas no BootScene. */
export const playerAnim = (kind: 'idle' | 'walk', facing: PlayerFacing): string => `${kind}_${facing}`;

/** Footprint de COLISÃO do jogador em pixels (independente do tamanho do sprite). */
export const PLAYER_W = 36;
export const PLAYER_H = 48;

// ─── Cão de estimação (pack Goldie, por Artoellie — `dogs/goldie.png`) ────────
// Sheet 32×40, 4 COLUNAS × 8 LINHAS. Linhas úteis para o pet:
//   4 = andar p/ baixo (de frente), 5 = andar p/ cima (de costas),
//   6 = andar de lado (virado p/ DIREITA no sheet → flipX quando anda p/ esquerda).
//   idle (sentado): 0 = de frente, 2 = de costas, 8 = de lado (virado p/ direita).
export const DOG_FRAME_W = 32;
export const DOG_FRAME_H = 40;
export const DOG_COLS = 4;

export type DogFacing = 'down' | 'up' | 'side';
/** Linha do ciclo de caminhada por direção. */
export const DogWalkRow: Record<DogFacing, number> = { down: 4, up: 5, side: 6 };
/** Frame estático de descanso (sentado) por direção — mesma orientação do walk. */
export const DogIdleFrame: Record<DogFacing, number> = { down: 0, up: 2, side: 8 };
/** Nome da animação de caminhada do cão (ex.: `dog_walk_side`). */
export const dogAnim = (facing: DogFacing): string => `dog_walk_${facing}`;

/** Mapeia o estágio (domínio) para a key da textura correspondente. */
export function cacaoTextureKey(stage: CacaoStage, dead: boolean): string {
  if (dead) return TextureKey.CacaoDead;
  switch (stage) {
    case 'muda':
      return TextureKey.CacaoMuda;
    case 'jovem':
      return TextureKey.CacaoJovem;
    case 'crescendo':
      return TextureKey.CacaoCrescendo;
    case 'maduro':
      return TextureKey.CacaoMaduro;
  }
}

/**
 * Gera as texturas do CACAU por código (o pack não traz cacau; manter os 5
 * estados desenhados à mão preserva a identidade da cultura). Cada textura tem
 * TILE×TILE com fundo transparente. Chamado uma vez no BootScene.
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const S = TILE;

  const tex = (key: string, draw: () => void): void => {
    g.clear();
    draw();
    g.generateTexture(key, S, S);
  };

  // ── Cacaueiro (estágios) ──────────────────────────────────────────────
  const stem = (h: number): void => {
    g.fillStyle(0x3f7a2e, 1).fillRect(S / 2 - 2, S - 12 - h, 4, h + 8);
  };
  tex(TextureKey.CacaoMuda, () => {
    stem(6);
    g.fillStyle(0x7bd06a, 1).fillCircle(S / 2, S - 18, 5);
  });
  tex(TextureKey.CacaoJovem, () => {
    stem(16);
    g.fillStyle(0x5fbf50, 1).fillCircle(S / 2, S - 28, 9);
  });
  tex(TextureKey.CacaoCrescendo, () => {
    stem(26);
    g.fillStyle(0x49a83e, 1).fillCircle(S / 2, S - 38, 13);
    g.fillStyle(0x49a83e, 1).fillCircle(S / 2 - 8, S - 30, 8);
    g.fillStyle(0x49a83e, 1).fillCircle(S / 2 + 8, S - 30, 8);
  });
  tex(TextureKey.CacaoMaduro, () => {
    stem(30);
    g.fillStyle(0x3f8f37, 1).fillCircle(S / 2, S - 42, 15);
    g.fillStyle(0x3f8f37, 1).fillCircle(S / 2 - 10, S - 32, 9);
    g.fillStyle(0x3f8f37, 1).fillCircle(S / 2 + 10, S - 32, 9);
    // frutos maduros (amarelo/laranja) = pronto para colher
    g.fillStyle(0xf2a63b, 1).fillEllipse(S / 2 - 12, S - 26, 8, 13);
    g.fillStyle(0xe07d2a, 1).fillEllipse(S / 2 + 12, S - 24, 8, 13);
  });
  tex(TextureKey.CacaoDead, () => {
    g.lineStyle(4, 0x6e5636, 1);
    g.beginPath();
    g.moveTo(S / 2, S - 6);
    g.lineTo(S / 2, S - 26);
    g.moveTo(S / 2, S - 20);
    g.lineTo(S / 2 - 10, S - 30);
    g.moveTo(S / 2, S - 22);
    g.lineTo(S / 2 + 11, S - 34);
    g.strokePath();
  });

  // ── Ícones/props de UI no mesmo vocabulário pixel-art do pack Farm Life ──
  tex(TextureKey.IconCacao, () => {
    g.fillStyle(0x5d3a22, 1).fillEllipse(29, 35, 24, 34);
    g.fillStyle(0x8c5126, 1).fillEllipse(35, 31, 20, 30);
    g.fillStyle(0xe8a43a, 1).fillEllipse(39, 28, 14, 24);
    g.lineStyle(2, 0x3a2418, 1).strokeEllipse(29, 35, 24, 34).strokeEllipse(35, 31, 20, 30);
    g.fillStyle(0x5fbf50, 1).fillEllipse(25, 17, 18, 9);
  });
  tex(TextureKey.IconHarvest, () => {
    g.fillStyle(0x6e3e1f, 1).fillRoundedRect(14, 27, 36, 22, 5);
    g.fillStyle(0xb86f32, 1).fillRoundedRect(17, 24, 30, 22, 4);
    g.lineStyle(3, 0x3a2418, 1).strokeRoundedRect(14, 27, 36, 22, 5);
    g.lineStyle(3, 0xd49a54, 1).beginPath();
    g.arc(32, 28, 16, Math.PI, 0);
    g.strokePath();
    g.fillStyle(0xe8a43a, 1).fillEllipse(23, 26, 8, 12).fillEllipse(32, 23, 8, 12).fillEllipse(41, 26, 8, 12);
  });
  tex(TextureKey.IconPrune, () => {
    g.lineStyle(5, 0xd8d8cf, 1);
    g.beginPath();
    g.moveTo(18, 42);
    g.lineTo(44, 18);
    g.moveTo(46, 42);
    g.lineTo(22, 18);
    g.strokePath();
    g.fillStyle(0x3a2418, 1).fillCircle(20, 45, 7).fillCircle(44, 45, 7);
    g.fillStyle(0x7bd06a, 1).fillCircle(20, 45, 3).fillCircle(44, 45, 3);
  });
  tex(TextureKey.IconSell, () => {
    g.fillStyle(0x7b4a27, 1).fillRoundedRect(13, 24, 38, 28, 4);
    g.fillStyle(0xa8642f, 1).fillRect(17, 20, 30, 10);
    g.lineStyle(3, 0x3a2418, 1).strokeRoundedRect(13, 24, 38, 28, 4).strokeRect(17, 20, 30, 10);
    g.fillStyle(0xf2c14e, 1).fillCircle(45, 20, 7);
    g.fillStyle(0x3a2418, 1).fillRect(31, 24, 3, 28);
  });
  tex(TextureKey.MarketStand, () => {
    g.fillStyle(0x2f2117, 0.35).fillEllipse(32, 56, 54, 10);
    g.fillStyle(0x7b4a27, 1).fillRect(11, 30, 42, 25);
    g.fillStyle(0xa8642f, 1).fillRect(15, 36, 34, 15);
    g.lineStyle(3, 0x3a2418, 1).strokeRect(11, 30, 42, 25);
    g.fillStyle(0xd84b3f, 1).fillRect(8, 18, 12, 13).fillRect(32, 18, 12, 13);
    g.fillStyle(0xf4d47a, 1).fillRect(20, 18, 12, 13).fillRect(44, 18, 12, 13);
    g.lineStyle(2, 0x3a2418, 1).strokeRect(8, 18, 48, 13);
    g.fillStyle(0x4e9e57, 1).fillCircle(22, 34, 4).fillCircle(30, 35, 4).fillCircle(38, 34, 4);
    g.fillStyle(0xf2c14e, 1).fillCircle(45, 39, 5);
  });
  tex(TextureKey.CottageClosed, () => {
    g.fillStyle(0x2b1b12, 0.35).fillEllipse(32, 59, 58, 10);
    g.fillStyle(0x6b3f22, 1).fillRect(8, 24, 48, 32);
    g.fillStyle(0x8b5a32, 1).fillRect(12, 28, 40, 24);
    g.lineStyle(3, 0x2d1b12, 1).strokeRect(8, 24, 48, 32);
    for (let y = 31; y <= 49; y += 8) {
      g.lineStyle(2, 0x4b2c18, 1).lineBetween(10, y, 54, y);
      g.lineStyle(1, 0xc08a55, 0.65).lineBetween(12, y - 2, 51, y - 2);
    }
    g.fillStyle(0x4f2d19, 1).fillRoundedRect(26, 36, 12, 20, 2);
    g.fillStyle(0xc98b42, 1).fillCircle(35, 46, 2);
    g.fillStyle(0x9c5930, 1).fillRect(14, 34, 10, 9);
    g.fillStyle(0xf2d28a, 1).fillRect(16, 36, 6, 5);
    g.lineStyle(2, 0x2d1b12, 1).strokeRect(14, 34, 10, 9);
    g.fillStyle(0x3a2418, 1).fillTriangle(4, 26, 32, 4, 60, 26);
    g.fillStyle(0x7b3f24, 1).fillTriangle(8, 26, 32, 8, 56, 26);
    g.lineStyle(3, 0x2d1b12, 1).strokeTriangle(4, 26, 32, 4, 60, 26);
    g.lineStyle(2, 0xb8783c, 1).lineBetween(16, 23, 48, 23);
    g.lineStyle(2, 0x5c321d, 1).lineBetween(23, 16, 41, 16);
    g.fillStyle(0x4b2c18, 1).fillRect(44, 11, 8, 13);
    g.fillStyle(0x2d1b12, 1).fillRect(42, 9, 12, 4);
  });

  g.destroy();
}
