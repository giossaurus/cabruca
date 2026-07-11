/**
 * Suporte a GAMEPAD — camada ADAPTER, no molde de `settings.ts`. Nenhuma regra
 * de jogo mora aqui: só detecção de controle, mapa fixo de botões→ações e os
 * glifos de prompt por família (ABXY no Xbox/PlayStation em PC, layout
 * físico do Nintendo com A/B e X/Y trocados).
 *
 * O mapa de botões é FIXO (sem rebind): o jogo tem poucas ações e o rebind de
 * pad dobraria o schema de settings sem retorno no escopo de jam. O teclado
 * continua sempre funcionando como fallback (pads fora do standard mapping).
 *
 * QA: `?padkind=xbox|playstation|nintendo` na URL força a família dos prompts,
 * para conferir os rótulos das 3 famílias com um único controle real (padrão
 * runtime, diferente do `VITE_GRID_DEBUG` de build em `debug.ts`).
 */
import Phaser from 'phaser';
import { keyLabel, type ActionId, type KeyBindings } from './ui/settings';

export type PadKind = 'xbox' | 'playstation' | 'nintendo' | 'generic';
export type InputDevice = 'keyboard' | 'gamepad';

/** Índices do standard mapping W3C — POSIÇÃO física do botão, não o rótulo. */
export const PAD = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

const STICK_DEADZONE = 0.25;

/** Override de QA via URL (`?padkind=…`), resolvido uma vez no load. */
const KIND_OVERRIDE: PadKind | undefined = (() => {
  if (typeof window === 'undefined') return undefined;
  const v = new URLSearchParams(window.location.search).get('padkind');
  return v === 'xbox' || v === 'playstation' || v === 'nintendo' || v === 'generic' ? v : undefined;
})();

/**
 * Família do controle a partir do `Gamepad.id` do browser. Testa nomes E
 * vendor ids em hex (Firefox reporta só `054c-0ce6-…`). Pad fora do standard
 * mapping vira 'generic' (índices não confiáveis → glifos numéricos).
 */
export function padKind(id: string, mapping?: string): PadKind {
  if (KIND_OVERRIDE) return KIND_OVERRIDE;
  if (mapping !== undefined && mapping !== 'standard') return 'generic';
  const lower = id.toLowerCase();
  if (/sony|playstation|dualsense|dualshock|054c/.test(lower)) return 'playstation';
  if (/nintendo|pro controller|joy-con|057e/.test(lower)) return 'nintendo';
  return 'xbox'; // família mais comum; ids Xbox nem sempre dizem "xbox"
}

/**
 * Glifo exibível por família. A coluna Nintendo já embute o swap físico:
 * o botão de BAIXO (índice 0) tem "B" serigrafado no Switch.
 */
const GLYPHS: Record<PadKind, Record<number, string>> = {
  xbox: { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'View', 9: 'Menu' },
  // Fallback de PC: a fonte RoadPixel nao cobre ✕○□△, entao usamos ABXY por
  // posicao fisica (sul/leste/oeste/norte), que e o padrao mais compativel.
  playstation: { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 8: 'Share', 9: 'Options' },
  nintendo: { 0: 'B', 1: 'A', 2: 'Y', 3: 'X', 4: 'L', 5: 'R', 6: 'ZL', 7: 'ZR', 8: '−', 9: '+' },
  generic: { 0: '(1)', 1: '(2)', 2: '(3)', 3: '(4)', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 8: 'Select', 9: 'Start' },
};

const DPAD_GLYPH: Record<number, string> = { 12: '✚↑', 13: '✚↓', 14: '✚←', 15: '✚→' };

export function buttonGlyph(kind: PadKind, button: number): string {
  return DPAD_GLYPH[button] ?? GLYPHS[kind][button] ?? `Botão ${button}`;
}

/** Mapa FIXO ação→botão — fonte única para o input E para os prompts. */
export const GAMEPAD_BUTTON_FOR_ACTION: Partial<Record<ActionId, number>> = {
  moveUp: PAD.dpadUp,
  moveDown: PAD.dpadDown,
  moveLeft: PAD.dpadLeft,
  moveRight: PAD.dpadRight,
  interact: PAD.south,
  sleep: PAD.north,
  sell: PAD.west,
  replant: PAD.lt,
  pause: PAD.start,
  // `restart` (R) fica só no teclado durante o jogo: é destrutivo demais para
  // um botão de pad sem confirmação. Na tela de fim, sul reinicia.
};

// ─── Último dispositivo usado (decide os prompts) ───────────────────────────

let device: InputDevice = 'keyboard';
let lastKind: PadKind = 'xbox';
const changeListeners = new Set<(d: InputDevice) => void>();

function setDevice(d: InputDevice): void {
  if (device === d) return;
  device = d;
  for (const cb of changeListeners) cb(d);
}

export function activeDevice(): InputDevice {
  return device;
}

/** Família do último pad usado ('xbox' se nenhum ainda; override de QA vence). */
export function activePadKind(): PadKind {
  return KIND_OVERRIDE ?? lastKind;
}

/** Chamar em TODO handler de gamepad — mantém `activeDevice`/`activePadKind`. */
export function noteGamepadUse(pad: Phaser.Input.Gamepad.Gamepad): void {
  lastKind = padKind(pad.id, (pad.pad as globalThis.Gamepad | undefined)?.mapping);
  setDevice('gamepad');
}

/** Assina mudanças teclado↔gamepad (para telas com rótulos estáticos). */
export function onDeviceChange(cb: (d: InputDevice) => void): () => void {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}

/** 1x no main.ts: qualquer tecla/clique volta os prompts para teclado. */
export function initDeviceWatcher(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('keydown', () => setDevice('keyboard'), true);
  document.addEventListener('pointerdown', () => setDevice('keyboard'), true);
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/**
 * Vetor de movimento do pad: stick esquerdo (com deadzone) + d-pad somados,
 * clampado a 8 direções digitais (o jogo foi tunado para movimento digital).
 * Ações de botão NÃO passam por aqui — usam os eventos 'down' do plugin.
 */
export function readPadDir(
  plugin: Phaser.Input.Gamepad.GamepadPlugin | null | undefined,
): { x: number; y: number } {
  if (!plugin || plugin.total === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const pad of plugin.gamepads) {
    if (!pad || !pad.connected) continue;
    if (Math.abs(pad.leftStick.x) > STICK_DEADZONE) x += Math.sign(pad.leftStick.x);
    if (Math.abs(pad.leftStick.y) > STICK_DEADZONE) y += Math.sign(pad.leftStick.y);
    if (pad.left) x -= 1;
    if (pad.right) x += 1;
    if (pad.up) y -= 1;
    if (pad.down) y += 1;
    if (x !== 0 || y !== 0) noteGamepadUse(pad);
  }
  return { x: Phaser.Math.Clamp(x, -1, 1), y: Phaser.Math.Clamp(y, -1, 1) };
}

/**
 * Rótulo do prompt de uma ação, decidido pelo último dispositivo usado:
 * glifo do pad (família correta) ou `keyLabel` do binding de teclado.
 */
export function promptLabel(action: ActionId, bindings: KeyBindings): string {
  if (device === 'gamepad') {
    const button = GAMEPAD_BUTTON_FOR_ACTION[action];
    if (button !== undefined) return buttonGlyph(activePadKind(), button);
  }
  return keyLabel(bindings[action]);
}
