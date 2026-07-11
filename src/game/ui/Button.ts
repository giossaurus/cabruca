import Phaser from 'phaser';
import { UI } from './theme';

export type ButtonVariant = 'default' | 'primary';

export interface ButtonConfig {
  x: number;
  y: number;
  label: string;
  onClick: () => void;
  width?: number;
  height?: number;
  variant?: ButtonVariant;
  fontSize?: string;
}

/**
 * Botão reutilizável (retângulo + rótulo) com estados hover/pressed/disabled.
 *
 * IMPORTANTE (Phaser 4): a interatividade fica no RETÂNGULO filho, não no
 * Container. `Container.setInteractive({hitArea})` não registra ponteiro no
 * Phaser 4 — um `Rectangle.setInteractive()` (mesmo aninhado) funciona.
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly variant: ButtonVariant;
  private readonly onClick: () => void;
  private _enabled = true;
  private focused = false;

  constructor(scene: Phaser.Scene, cfg: ButtonConfig) {
    super(scene, cfg.x, cfg.y);
    const w = cfg.width ?? 240;
    const h = cfg.height ?? 44;
    this.variant = cfg.variant ?? 'default';
    this.onClick = cfg.onClick;

    this.bg = scene.add.rectangle(0, 0, w, h, this.fillFor('idle')).setStrokeStyle(2, UI.color.stroke);
    this.label = scene.add
      .text(0, 0, cfg.label, {
        fontFamily: UI.font,
        fontSize: cfg.fontSize ?? UI.size.button,
        color: this.variant === 'primary' ? UI.text.onPrimary : UI.text.primary,
      })
      .setOrigin(0.5);

    this.add([this.bg, this.label]);
    this.setSize(w, h);

    // Interatividade no retângulo (funciona no Phaser 4).
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => this.paint('hover'));
    this.bg.on('pointerout', () => this.paint('idle'));
    this.bg.on('pointerdown', () => this.paint('down'));
    this.bg.on('pointerup', () => {
      if (!this._enabled) return;
      this.paint('hover');
      this.onClick();
    });

    scene.add.existing(this);
  }

  setEnabled(enabled: boolean): this {
    this._enabled = enabled;
    if (enabled) this.bg.setInteractive({ useHandCursor: true });
    else this.bg.disableInteractive();
    this.paint('idle');
    return this;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setFocused(focused: boolean): this {
    this.focused = focused;
    this.paint(focused ? 'hover' : 'idle');
    return this;
  }

  activate(): void {
    if (!this._enabled) return;
    this.paint('down');
    this.scene.time.delayedCall(70, () => {
      if (!this.active || !this.bg.active) return;
      this.paint(this.focused ? 'hover' : 'idle');
    });
    this.onClick();
  }

  private fillFor(state: 'idle' | 'hover' | 'down'): number {
    if (!this._enabled) return UI.color.panelDisabled;
    if (this.variant === 'primary') {
      return state === 'hover' ? UI.color.primaryHover : UI.color.primary;
    }
    if (state === 'hover') return UI.color.panelHover;
    if (state === 'down') return UI.color.panelDown;
    return UI.color.panel;
  }

  private paint(state: 'idle' | 'hover' | 'down'): void {
    this.bg.setFillStyle(this.fillFor(state));
    this.bg.setStrokeStyle(this.focused ? 4 : 2, this.focused ? UI.color.primaryHover : UI.color.stroke);
    const enabledColor = this.variant === 'primary' ? UI.text.onPrimary : UI.text.primary;
    this.label.setColor(this._enabled ? enabledColor : UI.text.muted);
  }
}
