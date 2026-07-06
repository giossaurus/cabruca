import type { IndicatorKey } from '../indicators/Indicators';

/**
 * Tabela de balanceamento — TODOS os números "tunáveis" do jogo num só lugar
 * (segue a convenção do ADR 0003: balanceamento é dado, não código espalhado).
 *
 * `Farm` recebe um `Partial<BalanceConfig>` e mescla sobre `DEFAULT_BALANCE`,
 * então testes e experimentos de balanceamento podem sobrescrever só o que
 * interessa (ex.: `new Farm({ totalDays: 1 })`).
 *
 * OBS: a mescla é rasa (shallow). Ao sobrescrever um objeto aninhado
 * (`energyCost`, `deltas`, `dailyDecay`) informe-o inteiro.
 */
export type IndicatorDelta = Partial<Record<IndicatorKey, number>>;

export interface BalanceConfig {
  /** Dimensões da grade da fazenda. */
  readonly gridWidth: number;
  readonly gridHeight: number;
  /** Slots do inventário. */
  readonly slotCount: number;
  /** Energia por dia (também é o teto restaurado ao dormir). */
  readonly startEnergy: number;
  /** Duração da partida em dias; ao fim decide-se vitória/derrota. */
  readonly totalDays: number;
  /** Piso de equilíbrio: vitória exige todos os indicadores >= este valor. */
  readonly winThreshold: number;
  /** Dias de crescimento por estágio do cacaueiro (no ideal). */
  readonly daysPerCacaoStage: number;
  /** Custo de energia por ação. */
  readonly energyCost: {
    readonly plantTree: number;
    readonly plantCacao: number;
    readonly harvest: number;
  };
  /** Deltas de indicador aplicados por ação. */
  readonly deltas: {
    readonly plantTree: IndicatorDelta;
    readonly plantCacao: IndicatorDelta;
    readonly harvest: IndicatorDelta;
    /** Por unidade vendida. */
    readonly sellPerUnit: IndicatorDelta;
  };
  /** Deltas aplicados a cada "dormir" (ex.: custo de manutenção). */
  readonly dailyDecay: IndicatorDelta;
}

export const DEFAULT_BALANCE: BalanceConfig = {
  gridWidth: 8,
  gridHeight: 8,
  slotCount: 10,
  startEnergy: 8,
  totalDays: 12,
  winThreshold: 40,
  daysPerCacaoStage: 2,
  energyCost: {
    plantTree: 1,
    plantCacao: 1,
    harvest: 1,
  },
  deltas: {
    // Plantar nativa fortalece a biodiversidade.
    plantTree: { biodiversidade: 3 },
    // Diversificar cultivo ajuda um pouco a biodiversidade.
    plantCacao: { biodiversidade: 1 },
    // Colher gera valor (pequeno) na economia.
    harvest: { economia: 1 },
    // Vender: economia sobe; vender/escoar à comunidade dá um bônus menor.
    sellPerUnit: { economia: 4, comunidade: 1 },
  },
  // Custo de manutenção diário: sem vender, a economia sangra — cria a pressão
  // que torna o loop (colher → vender) necessário.
  dailyDecay: { economia: -2 },
};

export const ITEM_CACAU_FRESCO = 'cacau_fresco';
