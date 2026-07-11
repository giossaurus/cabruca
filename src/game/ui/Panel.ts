import Phaser from 'phaser';
import { DEPTH } from '../depths';
import { UI } from './theme';

export interface PanelConfig {
  /** Largura/altura do cartão central. */
  width: number;
  height: number;
  title?: string;
  /** Escurece a tela inteira atrás do cartão (modal). Default: true. */
  dim?: boolean;
}

/**
 * Cartão modal centrado na tela, com dimmer opcional atrás e título opcional.
 * Adicione conteúdo com `addContent(...)` (coordenadas relativas ao centro do
 * cartão). Depth alto para ficar sobre o mundo/outras cenas.
 */
export class Panel extends Phaser.GameObjects.Container {
  readonly cardW: number;
  readonly cardH: number;

  constructor(scene: Phaser.Scene, cfg: PanelConfig) {
    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;
    super(scene, cx, cy);
    this.cardW = cfg.width;
    this.cardH = cfg.height;

    if (cfg.dim ?? true) {
      // Centro do container = centro da tela → um retângulo full-screen em (0,0)
      // local cobre a tela inteira atrás do cartão.
      const dim = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, UI.color.overlay, 0.72);
      this.add(dim);
    }

    const card = scene.add
      .rectangle(0, 0, cfg.width, cfg.height, UI.color.bgMenu)
      .setStrokeStyle(2, UI.color.stroke);
    this.add(card);

    if (cfg.title) {
      const title = scene.add
        .text(0, -cfg.height / 2 + 34, cfg.title, {
          fontFamily: UI.font,
          fontSize: UI.size.heading,
          color: UI.text.primary,
        })
        .setOrigin(0.5);
      this.add(title);
    }

    this.setDepth(DEPTH.modal);
    scene.add.existing(this);
  }

  /** Adiciona objetos ao cartão (coords relativas ao centro do cartão). */
  addContent(...objects: Phaser.GameObjects.GameObject[]): this {
    this.add(objects);
    return this;
  }
}
