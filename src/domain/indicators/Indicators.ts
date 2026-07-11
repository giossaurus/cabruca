/**
 * Três indicadores de equilíbrio (rascunhos_iniciais.md).
 * Cada um varia de 0 a 100 e começa em 50. O jogador nunca "vence" por
 * dinheiro apenas — precisa manter Biodiversidade + Economia + Comunidade
 * equilibrados.
 */

export type IndicatorKey = 'biodiversidade' | 'economia' | 'comunidade';

export const INDICATOR_KEYS: readonly IndicatorKey[] = [
  'biodiversidade',
  'economia',
  'comunidade',
];

export const MIN = 0;
export const MAX = 100;
export const START = 50;

function clamp(v: number): number {
  return Math.max(MIN, Math.min(MAX, v));
}

export class Indicators {
  private readonly values: Record<IndicatorKey, number>;

  constructor(initial: number = START) {
    const start = clamp(initial);
    this.values = {
      biodiversidade: start,
      economia: start,
      comunidade: start,
    };
  }

  get(key: IndicatorKey): number {
    return this.values[key];
  }

  /** Aplica deltas (positivos ou negativos), sempre com clamp em [0, 100]. */
  apply(delta: Partial<Record<IndicatorKey, number>>): void {
    for (const key of INDICATOR_KEYS) {
      const d = delta[key];
      if (d !== undefined) {
        this.values[key] = clamp(this.values[key] + d);
      }
    }
  }

  /** Menor indicador — útil como métrica de equilíbrio / condição de derrota. */
  min(): number {
    return Math.min(...INDICATOR_KEYS.map((k) => this.values[k]));
  }

  average(): number {
    const total = INDICATOR_KEYS.reduce((s, k) => s + this.values[k], 0);
    return total / INDICATOR_KEYS.length;
  }

  /** true se todos os indicadores estão >= threshold. */
  allAbove(threshold: number): boolean {
    return INDICATOR_KEYS.every((k) => this.values[k] >= threshold);
  }

  snapshot(): Record<IndicatorKey, number> {
    return { ...this.values };
  }

  /** Reconstrói a partir de valores salvos (com clamp defensivo em [0,100]). */
  static fromState(values: Record<IndicatorKey, number>): Indicators {
    const ind = new Indicators();
    for (const key of INDICATOR_KEYS) {
      const v = values[key];
      ind.values[key] = clamp(typeof v === 'number' ? v : START);
    }
    return ind;
  }
}
