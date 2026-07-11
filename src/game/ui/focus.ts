import Phaser from 'phaser';
import { normalizeKeyCode } from './settings';
import { PAD, noteGamepadUse } from '../gamepad';

export interface FocusItem {
  readonly label: string;
  readonly enabled?: () => boolean;
  readonly onFocus?: (focused: boolean) => void;
  readonly onActivate?: () => void;
  readonly onLeft?: () => void;
  readonly onRight?: () => void;
}

export class FocusList {
  private index = 0;
  private domHandler: ((e: KeyboardEvent) => void) | undefined;
  private padHandler:
    | ((pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => void)
    | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly items: readonly FocusItem[],
    private readonly announce?: (message: string) => void,
    private readonly initialIndex = 0,
    /** "Voltar" do gamepad (botão leste/Start) — normalmente o handler de ESC da cena. */
    private readonly onBack?: () => void,
  ) {
    this.focusFirst();
    this.bind();
    this.bindGamepad();
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private bind(): void {
    if (typeof document === 'undefined') return;
    this.domHandler = (e: KeyboardEvent) => {
      if (!this.scene.scene.isActive(this.scene.sys.settings.key)) return;
      const code = normalizeKeyCode(e);
      if (code === 'UP') {
        e.preventDefault();
        this.navigate(-1);
      } else if (code === 'DOWN') {
        e.preventDefault();
        this.navigate(1);
      } else if (code === 'LEFT') {
        e.preventDefault();
        this.left();
      } else if (code === 'RIGHT') {
        e.preventDefault();
        this.right();
      } else if (code === 'SPACE' || code === 'ENTER') {
        e.preventDefault();
        this.activate();
      } else if (code === 'TAB') {
        e.preventDefault();
        this.navigate(e.shiftKey ? -1 : 1);
      }
    };
    document.addEventListener('keydown', this.domHandler, true);
  }

  /**
   * Gamepad: d-pad move o foco/ajusta sliders, sul ativa, leste/Start voltam.
   * Mesmo modelo do teclado — os widgets não sabem de onde veio o input.
   */
  private bindGamepad(): void {
    const gp = this.scene.input.gamepad;
    if (!gp) return;
    this.padHandler = (pad, button) => {
      if (!this.scene.scene.isActive(this.scene.sys.settings.key)) return;
      noteGamepadUse(pad);
      switch (button.index) {
        case PAD.dpadUp: this.navigate(-1); break;
        case PAD.dpadDown: this.navigate(1); break;
        case PAD.dpadLeft: this.left(); break;
        case PAD.dpadRight: this.right(); break;
        case PAD.south: this.activate(); break;
        case PAD.east:
        case PAD.start:
          this.onBack?.();
          break;
      }
    };
    gp.on('down', this.padHandler);
  }

  destroy(): void {
    if (this.domHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.domHandler, true);
    }
    this.domHandler = undefined;
    if (this.padHandler) {
      this.scene.input.gamepad?.off('down', this.padHandler);
    }
    this.padHandler = undefined;
  }

  /** Move o foco (com wrap e pulo de desabilitados). Público p/ input externo. */
  navigate(delta: number): void {
    this.move(delta);
  }

  activate(): void {
    this.current()?.onActivate?.();
  }

  left(): void {
    this.current()?.onLeft?.();
  }

  right(): void {
    this.current()?.onRight?.();
  }

  private focusFirst(): void {
    const initial = this.items[this.initialIndex];
    if (initial && (initial.enabled?.() ?? true)) {
      this.index = this.initialIndex;
      this.paint();
      return;
    }
    const i = this.items.findIndex((item) => item.enabled?.() ?? true);
    this.index = i >= 0 ? i : 0;
    this.paint();
  }

  private current(): FocusItem | undefined {
    return this.items[this.index];
  }

  private move(delta: number): void {
    if (this.items.length === 0) return;
    const previous = this.index;
    for (let step = 1; step <= this.items.length; step++) {
      const next = Phaser.Math.Wrap(this.index + delta * step, 0, this.items.length);
      if (this.items[next]?.enabled?.() ?? true) {
        this.index = next;
        break;
      }
    }
    if (previous !== this.index) this.paint();
  }

  private paint(): void {
    this.items.forEach((item, i) => item.onFocus?.(i === this.index));
    const item = this.current();
    if (item) this.announce?.(`Foco em ${item.label}`);
  }
}
