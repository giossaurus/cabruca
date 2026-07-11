import Phaser from 'phaser';
import { normalizeKeyCode } from './settings';

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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly items: readonly FocusItem[],
    private readonly announce?: (message: string) => void,
    private readonly initialIndex = 0,
  ) {
    this.focusFirst();
    this.bind();
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private bind(): void {
    if (typeof document === 'undefined') return;
    this.domHandler = (e: KeyboardEvent) => {
      if (!this.scene.scene.isActive(this.scene.sys.settings.key)) return;
      const code = normalizeKeyCode(e);
      if (code === 'UP') {
        e.preventDefault();
        this.move(-1);
      } else if (code === 'DOWN') {
        e.preventDefault();
        this.move(1);
      } else if (code === 'LEFT') {
        e.preventDefault();
        this.current()?.onLeft?.();
      } else if (code === 'RIGHT') {
        e.preventDefault();
        this.current()?.onRight?.();
      } else if (code === 'SPACE' || code === 'ENTER') {
        e.preventDefault();
        this.current()?.onActivate?.();
      } else if (code === 'TAB') {
        e.preventDefault();
        this.move(e.shiftKey ? -1 : 1);
      }
    };
    document.addEventListener('keydown', this.domHandler, true);
  }

  destroy(): void {
    if (this.domHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.domHandler, true);
    }
    this.domHandler = undefined;
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
