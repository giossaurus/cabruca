import Phaser from 'phaser';
import { createPlaceholderTextures } from '../assets';

/**
 * Prepara os assets antes do jogo. Hoje gera texturas placeholder por código.
 *
 * Quando houver sprites finais em `src/assets/`, mova o carregamento para o
 * `preload()` abaixo (`this.load.image(TextureKey.X, 'assets/x.png')`) e remova
 * a geração procedural — as keys em `assets.ts` continuam as mesmas.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // this.load.image(TextureKey.Grass, 'assets/grass.png'); // ← quando houver PNGs
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start('FarmScene');
  }
}
