import type { ColorFilter, Settings } from './ui';

const LIVE_ID = 'cabruca-live-region';
const CANVAS_LABEL =
  'CABRUCA. Jogo de fazenda em pixel art. Use Tab ou setas nos menus. No jogo, use as teclas configuradas para mover, interagir, abrir inventário e pausar.';

const FILTERS: Record<ColorFilter, string> = {
  none: 'none',
  protanopia: 'saturate(0.72) sepia(0.18) hue-rotate(-18deg) contrast(1.08)',
  deuteranopia: 'saturate(0.68) sepia(0.12) hue-rotate(18deg) contrast(1.1)',
  tritanopia: 'saturate(0.72) sepia(0.1) hue-rotate(78deg) contrast(1.08)',
  highContrast: 'contrast(1.35) saturate(1.18) brightness(1.04)',
};

function ensureLiveRegion(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  let node = document.getElementById(LIVE_ID);
  if (!node) {
    node = document.createElement('div');
    node.id = LIVE_ID;
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.setAttribute('aria-atomic', 'true');
    Object.assign(node.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
      left: '0',
      top: '0',
    });
    document.body.appendChild(node);
  }
  return node;
}

function gameCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('#app canvas');
}

export function applyAccessibilitySettings(settings: Settings): void {
  if (typeof document === 'undefined') return;
  const app = document.getElementById('app');
  if (app) app.style.filter = FILTERS[settings.colorFilter];

  const canvas = gameCanvas();
  if (canvas) {
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', CANVAS_LABEL);
    if (document.activeElement !== canvas) canvas.focus({ preventScroll: true });
  }

  ensureLiveRegion();
}

export function announce(settings: Pick<Settings, 'screenReader'>, message: string): void {
  if (!settings.screenReader) return;
  const node = ensureLiveRegion();
  if (!node) return;
  node.textContent = '';
  window.setTimeout(() => {
    node.textContent = message;
  }, 20);
}
