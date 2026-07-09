import Phaser from 'phaser';
import { UI } from './theme';

export interface StatBarConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  /** Rótulo opcional à esquerda da barra (ex.: "Energia"). */
  caption?: string;
}

/**
 * Barra de progresso (fundo + preenchimento proporcional + valor à direita).
 * Extrai o padrão `makeBar/setBar` que vivia em FarmScene. Origem no canto
 * superior-esquerdo em (x,y); o texto do valor fica logo após a barra.
 */
export class StatBar extends Phaser.GameObjects.Container {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly barW: number;

  constructor(scene: Phaser.Scene, cfg: StatBarConfig) {
    super(scene, cfg.x, cfg.y);
    this.barW = cfg.width;

    let bx = 0;
    if (cfg.caption) {
      const cap = scene.add
        .text(0, cfg.height / 2, cfg.caption, { fontFamily: UI.font, fontSize: UI.size.tiny, color: UI.text.soft })
        .setOrigin(0, 0.5);
      this.add(cap);
      bx = cap.width + 8;
    }

    const bg = scene.add.rectangle(bx, 0, cfg.width, cfg.height, UI.color.barBg).setOrigin(0, 0).setStrokeStyle(1, UI.color.strokeSoft);
    this.fill = scene.add.rectangle(bx, 0, cfg.width, cfg.height, cfg.color).setOrigin(0, 0);
    this.valueText = scene.add.text(bx + cfg.width + 8, cfg.height / 2, '', {
      fontFamily: UI.font,
      fontSize: UI.size.small,
      color: UI.text.primary,
    }).setOrigin(0, 0.5);

    this.add([bg, this.fill, this.valueText]);
    scene.add.existing(this);
  }

  /** pct em 0..1; label é o texto exibido ao lado (ex.: "8/8" ou "50"). */
  set(pct: number, label: string): void {
    this.fill.width = Phaser.Math.Clamp(pct, 0, 1) * this.barW;
    this.valueText.setText(label);
  }
}
