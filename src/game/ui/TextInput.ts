import Phaser from 'phaser';
import { UI } from './theme';
import { normalizeKeyCode } from './settings';

export interface TextInputConfig {
  x: number;
  y: number;
  width: number;
  height?: number;
  maxLength?: number;
  placeholder?: string;
  initial?: string;
  /** Chamado a cada mudança do texto (ex.: habilitar/desabilitar "Continuar"). */
  onChange?: (value: string) => void;
  /** Enter — normalmente confirma o formulário. */
  onSubmit?: () => void;
}

/**
 * Campo de texto NATIVO (sem DOM). O Phaser DOM não está ligado (ver main.ts),
 * então capturamos o teclado direto no `document` — mesmo padrão do `FocusList`
 * (`focus.ts`): guard por cena ativa e limpeza no SHUTDOWN. Setas/Tab são
 * ignoradas de propósito para não competir com a navegação do `FocusList`.
 */
export class TextInput extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly caret: Phaser.GameObjects.Rectangle;
  private readonly placeholder: string;
  private readonly maxLength: number;
  private readonly padX = 12;
  private value: string;
  private domHandler: ((e: KeyboardEvent) => void) | undefined;
  private caretTween: Phaser.Tweens.Tween | undefined;

  constructor(scene: Phaser.Scene, cfg: TextInputConfig) {
    super(scene, cfg.x, cfg.y);
    const w = cfg.width;
    const h = cfg.height ?? 40;
    this.placeholder = cfg.placeholder ?? '';
    this.maxLength = cfg.maxLength ?? 16;
    this.value = cfg.initial ?? '';

    this.bg = scene.add
      .rectangle(0, 0, w, h, UI.color.panelDown)
      .setStrokeStyle(2, UI.color.stroke);
    this.label = scene.add
      .text(-w / 2 + this.padX, 0, '', {
        fontFamily: UI.font,
        fontSize: UI.size.button,
        color: UI.text.primary,
      })
      .setOrigin(0, 0.5);
    this.caret = scene.add.rectangle(0, 0, 2, h - 16, UI.color.primaryHover).setOrigin(0, 0.5);

    this.add([this.bg, this.label, this.caret]);
    this.setSize(w, h);
    this.repaint();

    this.caretTween = scene.tweens.add({
      targets: this.caret,
      alpha: 0,
      duration: 520,
      yoyo: true,
      repeat: -1,
    });

    this.bind(cfg);
    scene.add.existing(this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  getValue(): string {
    return this.value;
  }

  private bind(cfg: TextInputConfig): void {
    if (typeof document === 'undefined') return;
    this.domHandler = (e: KeyboardEvent) => {
      if (!this.active) return;
      if (!this.scene.scene.isActive(this.scene.sys.settings.key)) return;
      const code = normalizeKeyCode(e);
      if (code === 'UP' || code === 'DOWN' || code === 'LEFT' || code === 'RIGHT' || code === 'TAB') {
        return; // navegação fica a cargo do FocusList
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        cfg.onSubmit?.();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (this.value.length > 0) {
          this.value = this.value.slice(0, -1);
          this.repaint();
          cfg.onChange?.(this.value);
        }
        return;
      }
      // Caractere imprimível único (letras, dígitos, espaço, acentos).
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.value.length >= this.maxLength) return;
        e.preventDefault();
        this.value += e.key;
        this.repaint();
        cfg.onChange?.(this.value);
      }
    };
    document.addEventListener('keydown', this.domHandler, true);
  }

  private repaint(): void {
    const empty = this.value.length === 0;
    this.label.setText(empty ? this.placeholder : this.value);
    this.label.setColor(empty ? UI.text.muted : UI.text.primary);
    this.caret.setX(-this.bg.width / 2 + this.padX + (empty ? 0 : this.label.width) + 2);
  }

  override destroy(fromScene?: boolean): void {
    if (this.domHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.domHandler, true);
    }
    this.domHandler = undefined;
    this.caretTween?.remove();
    this.caretTween = undefined;
    super.destroy(fromScene);
  }
}
