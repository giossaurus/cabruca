/**
 * Preferências do jogador, persistidas em localStorage. Camada ADAPTER: não é
 * regra de jogo. `volume` também é aplicado ao mixer do Phaser em cada cena.
 */
export interface Settings {
  volume: number; // mestre, 0..1
  musicVolume: number; // 0..1
  ambienceVolume: number; // 0..1
  showTips: boolean;
  mouseEnabled: boolean;
  mouseSensitivity: number; // 0..1; traduzido para velocidade do clique/movimento
  colorFilter: ColorFilter;
  screenReader: boolean;
  keyBindings: KeyBindings;
  displayMode: DisplayMode;
  /** Id de resolução (ver RESOLUTIONS em display.ts). 'auto' segue a janela. */
  resolution: string;
}

export type ColorFilter = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'highContrast';

/** 'fit' = mantém proporção com barras; 'fill' = preenche a janela sem barras. */
export type DisplayMode = 'fit' | 'fill';

export type ActionId =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'interact'
  | 'inventory'
  | 'sleep'
  | 'sell'
  | 'replant'
  | 'pause';

export type KeyBindings = Record<ActionId, string>;

const KEY = 'cabruca:settings';

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveUp: 'W',
  moveDown: 'S',
  moveLeft: 'A',
  moveRight: 'D',
  interact: 'E',
  inventory: 'I',
  sleep: 'Z',
  sell: 'V',
  replant: 'U',
  pause: 'ESC',
};

export const ACTION_LABEL: Record<ActionId, string> = {
  moveUp: 'Mover cima',
  moveDown: 'Mover baixo',
  moveLeft: 'Mover esquerda',
  moveRight: 'Mover direita',
  interact: 'Interagir',
  inventory: 'Inventário',
  sleep: 'Dormir',
  sell: 'Vender',
  replant: 'Replantar/undo',
  pause: 'Pausar/voltar',
};

const DEFAULTS: Settings = {
  volume: 0.8,
  musicVolume: 0.6,
  ambienceVolume: 0.5,
  showTips: true,
  mouseEnabled: true,
  mouseSensitivity: 0.5,
  colorFilter: 'none',
  screenReader: false,
  keyBindings: DEFAULT_KEY_BINDINGS,
  displayMode: 'fit',
  resolution: 'auto',
};

/** Lê um número 0..1, com fallback ao default se ausente/ inválido. */
function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : fallback;
}

function colorFilter(v: unknown): ColorFilter {
  return v === 'protanopia' || v === 'deuteranopia' || v === 'tritanopia' || v === 'highContrast' || v === 'none'
    ? v
    : DEFAULTS.colorFilter;
}

function keyBindings(v: unknown): KeyBindings {
  const parsed = typeof v === 'object' && v ? v as Partial<KeyBindings> : {};
  const merged: KeyBindings = { ...DEFAULT_KEY_BINDINGS };
  for (const key of Object.keys(DEFAULT_KEY_BINDINGS) as ActionId[]) {
    const value = parsed[key];
    merged[key] = typeof value === 'string' && value.length > 0 ? value : DEFAULT_KEY_BINDINGS[key];
  }
  return merged;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      volume: clamp01(parsed.volume, DEFAULTS.volume),
      musicVolume: clamp01(parsed.musicVolume, DEFAULTS.musicVolume),
      ambienceVolume: clamp01(parsed.ambienceVolume, DEFAULTS.ambienceVolume),
      showTips: typeof parsed.showTips === 'boolean' ? parsed.showTips : DEFAULTS.showTips,
      mouseEnabled: typeof parsed.mouseEnabled === 'boolean' ? parsed.mouseEnabled : DEFAULTS.mouseEnabled,
      mouseSensitivity: clamp01(parsed.mouseSensitivity, DEFAULTS.mouseSensitivity),
      colorFilter: colorFilter(parsed.colorFilter),
      screenReader: typeof parsed.screenReader === 'boolean' ? parsed.screenReader : DEFAULTS.screenReader,
      keyBindings: keyBindings(parsed.keyBindings),
      displayMode: parsed.displayMode === 'fill' || parsed.displayMode === 'fit' ? parsed.displayMode : DEFAULTS.displayMode,
      resolution: typeof parsed.resolution === 'string' && parsed.resolution.length > 0 ? parsed.resolution : DEFAULTS.resolution,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignora ambientes sem localStorage
  }
}

export function resetKeyBindings(s: Settings): Settings {
  return { ...s, keyBindings: { ...DEFAULT_KEY_BINDINGS } };
}

export function keyLabel(code: string): string {
  const labels: Record<string, string> = {
    SPACE: 'Espaço',
    ESC: 'ESC',
    UP: '↑',
    DOWN: '↓',
    LEFT: '←',
    RIGHT: '→',
  };
  return labels[code] ?? code;
}

export function normalizeKeyCode(e: KeyboardEvent): string {
  if (e.code === 'Space') return 'SPACE';
  if (e.code === 'Escape') return 'ESC';
  if (e.code === 'ArrowUp') return 'UP';
  if (e.code === 'ArrowDown') return 'DOWN';
  if (e.code === 'ArrowLeft') return 'LEFT';
  if (e.code === 'ArrowRight') return 'RIGHT';
  if (e.code.startsWith('Key')) return e.code.slice(3).toUpperCase();
  if (e.code.startsWith('Digit')) return e.code.slice(5);
  return e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase();
}

export function phaserKeyName(code: string): string {
  if (code === 'ESC') return 'ESC';
  if (code === 'SPACE') return 'SPACE';
  if (code === 'UP') return 'UP';
  if (code === 'DOWN') return 'DOWN';
  if (code === 'LEFT') return 'LEFT';
  if (code === 'RIGHT') return 'RIGHT';
  return code;
}
