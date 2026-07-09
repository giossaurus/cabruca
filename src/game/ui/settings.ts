/**
 * Preferências do jogador, persistidas em localStorage. Camada ADAPTER: não é
 * regra de jogo. `volume` também é aplicado ao mixer do Phaser em cada cena.
 */
export interface Settings {
  volume: number; // mestre, 0..1
  musicVolume: number; // 0..1
  ambienceVolume: number; // 0..1
  showTips: boolean;
}

const KEY = 'cabruca:settings';

const DEFAULTS: Settings = {
  volume: 0.8,
  musicVolume: 0.6,
  ambienceVolume: 0.5,
  showTips: true,
};

/** Lê um número 0..1, com fallback ao default se ausente/ inválido. */
function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : fallback;
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
