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
  // Cacau (procedural — ver createPlaceholderTextures).
  CacaoMuda: 'cacao_muda',
  CacaoJovem: 'cacao_jovem',
  CacaoCrescendo: 'cacao_crescendo',
  CacaoMaduro: 'cacao_maduro',
  CacaoDead: 'cacao_dead',
  // Jogador (spritesheets direcionais do pack).
  PlayerIdle: 'player_idle',
  PlayerWalk: 'player_walk',
  // UI (assets custom já existentes).
  SlotBar: 'slot_bar',
  PodarPrata: 'podar_prata',
  PodarPreto: 'podar_preto',
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

  g.destroy();
}
