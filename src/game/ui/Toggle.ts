import Phaser from 'phaser';
import { UI } from './theme';

export interface ToggleConfig {
  x: number;
  y: number;
  label: string;
  value?: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Toggle on/off (caixa + marca + rótulo à direita). Container centrado em (x,y);
 * (x) é a borda esquerda da caixa.
 */
export class Toggle extends Phaser.GameObjects.Container {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly mark: Phaser.GameObjects.Rectangle;
  private readonly onChange: (value: boolean) => void;
  private _value: boolean;
  private focused = false;

  constructor(scene: Phaser.Scene, cfg: ToggleConfig) {
    super(scene, cfg.x, cfg.y);
    this._value = cfg.value ?? false;
    this.onChange = cfg.onChange;

    const s = 24;
    this.box = scene.add.rectangle(s / 2, 0, s, s, UI.color.panel).setStrokeStyle(2, UI.color.stroke);
    this.mark = scene.add.rectangle(s / 2, 0, s - 10, s - 10, UI.color.primary).setVisible(this._value);
    const label = scene.add
      .text(s + 12, 0, cfg.label, { fontFamily: UI.font, fontSize: UI.size.body, color: UI.text.primary })
      .setOrigin(0, 0.5);

    this.add([this.box, this.mark, label]);

    const hitW = s + 16 + label.width;
    const hit = scene.add.rectangle(hitW / 2, 0, hitW, s + 8, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    this.add(hit);
    hit.on('pointerdown', () => this.toggle());

    scene.add.existing(this);
  }

  get value(): boolean {
    return this._value;
  }

  toggle(): void {
    this.setValue(!this._value);
  }

  setValue(v: boolean): void {
    this._value = v;
    this.mark.setVisible(v);
    this.box.setFillStyle(v ? UI.color.panelHover : UI.color.panel);
    this.box.setStrokeStyle(this.focused ? 4 : 2, this.focused ? UI.color.primaryHover : UI.color.stroke);
    this.onChange(v);
  }

  setFocused(focused: boolean): this {
    this.focused = focused;
    this.box.setStrokeStyle(focused ? 4 : 2, focused ? UI.color.primaryHover : UI.color.stroke);
    return this;
  }
}
