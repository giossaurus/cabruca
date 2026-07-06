import Phaser from 'phaser';
import type { CacaoStage } from '../domain';

/**
 * Contrato de KEYS de textura do jogo. O render (FarmScene) só conhece estas
 * keys — nunca de onde a imagem veio.
 *
 * Hoje as texturas são PLACEHOLDERS gerados por código (`createPlaceholderTextures`)
 * para o jogo já ser jogável/testável sem depender de arquivos. Quando o artist
 * entregar os sprites finais (ou ao baixar um pack CC0 para `src/assets/`), basta
 * trocar a geração por `scene.load.image(TextureKey.X, 'assets/x.png')` no BootScene:
 * o resto do código não muda.
 */
export const TextureKey = {
  Grass: 'grass',
  Dirt: 'dirt',
  TreeSapling: 'tree_sapling',
  TreeMature: 'tree_mature',
  CacaoMuda: 'cacao_muda',
  CacaoJovem: 'cacao_jovem',
  CacaoCrescendo: 'cacao_crescendo',
  CacaoMaduro: 'cacao_maduro',
  CacaoDead: 'cacao_dead',
} as const;

export const TILE = 64;

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
 * Gera todas as texturas placeholder (formas/cores que lêem bem). Chamado uma
 * vez no BootScene. Cada textura tem TILE×TILE com fundo transparente (exceto
 * os tiles de chão, que preenchem tudo).
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const S = TILE;

  const tex = (key: string, draw: () => void): void => {
    g.clear();
    draw();
    g.generateTexture(key, S, S);
  };

  // ── Chão ──────────────────────────────────────────────────────────────
  tex(TextureKey.Grass, () => {
    g.fillStyle(0x2e5d34, 1).fillRect(0, 0, S, S);
    g.fillStyle(0x356b3c, 1);
    for (let i = 0; i < 10; i++) {
      const x = (i * 23) % S;
      const y = (i * 41) % S;
      g.fillRect(x, y, 3, 3);
    }
    g.lineStyle(1, 0x244a29, 1).strokeRect(0.5, 0.5, S - 1, S - 1);
  });

  tex(TextureKey.Dirt, () => {
    g.fillStyle(0x6b4a2b, 1).fillRect(0, 0, S, S);
    g.lineStyle(1, 0x4f3720, 1).strokeRect(0.5, 0.5, S - 1, S - 1);
  });

  // ── Árvore nativa ─────────────────────────────────────────────────────
  // Recém-plantada: muda pequena.
  tex(TextureKey.TreeSapling, () => {
    g.fillStyle(0x6b4a2b, 1).fillRect(S / 2 - 3, S / 2 + 6, 6, 16); // tronco
    g.fillStyle(0x4e9e57, 1).fillCircle(S / 2, S / 2, 10); // copa pequena
  });
  // Madura: copa grande e escura (gera sombra).
  tex(TextureKey.TreeMature, () => {
    g.fillStyle(0x5a3d22, 1).fillRect(S / 2 - 5, S / 2, 10, 26); // tronco
    g.fillStyle(0x1f5c2b, 1).fillCircle(S / 2, S / 2 - 4, 26); // copa
    g.fillStyle(0x2b7d3a, 1).fillCircle(S / 2 - 8, S / 2 - 2, 14);
    g.fillStyle(0x2b7d3a, 1).fillCircle(S / 2 + 9, S / 2 - 6, 12);
  });

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
