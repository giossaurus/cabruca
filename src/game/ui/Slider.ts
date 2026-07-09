import Phaser from 'phaser';
import { UI } from './theme';

export interface SliderConfig {
  x: number;
  y: number;
  width?: number;
  value?: number; // 0..1
  onChange: (value: number) => void;
}

/**
 * Slider horizontal 0..1 (trilho + preenchimento + knob arrastável). Clique no
 * trilho salta para a posição; arrastar o knob ajusta continuamente.
 * Container centrado verticalmente em (x,y); (x) é a borda esquerda do trilho.
 */
export class Slider extends Phaser.GameObjects.Container {
  private readonly trackW: number;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly knob: Phaser.GameObjects.Rectangle;
  private readonly onChange: (value: number) => void;
  private _value: number;
  private dragging = false;

  constructor(scene: Phaser.Scene, cfg: SliderConfig) {
    super(scene, cfg.x, cfg.y);
    const w = cfg.width ?? 220;
    this.trackW = w;
    this._value = Phaser.Math.Clamp(cfg.value ?? 1, 0, 1);
    this.onChange = cfg.onChange;

    const h = 8;
    scene.add.rectangle(0, 0, w, h, UI.color.barBg).setOrigin(0, 0.5).setStrokeStyle(1, UI.color.strokeSoft);
    this.fill = scene.add.rectangle(0, 0, w * this._value, h, UI.color.primary).setOrigin(0, 0.5);
    this.knob = scene.add
      .rectangle(w * this._value, 0, 14, 22, UI.color.primaryHover)
      .setStrokeStyle(2, UI.color.stroke);

    this.add([this.fill, this.knob]);

    // Zona de arrasto: cobre todo o trilho + folga vertical.
    const hit = scene.add.rectangle(w / 2, 0, w + 20, 28, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    this.add(hit);

    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.setFromPointer(p);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.setFromPointer(p);
    });
    scene.input.on('pointerup', () => {
      this.dragging = false;
    });

    scene.add.existing(this);
  }

  get value(): number {
    return this._value;
  }

  private setFromPointer(p: Phaser.Input.Pointer): void {
    // x local do trilho: a borda esquerda está em this.x (origin 0).
    const local = Phaser.Math.Clamp((p.worldX - this.x) / this.trackW, 0, 1);
    this.setValue(local);
  }

  setValue(v: number): void {
    this._value = Phaser.Math.Clamp(v, 0, 1);
    this.fill.width = this.trackW * this._value;
    this.knob.x = this.trackW * this._value;
    this.onChange(this._value);
  }
}
