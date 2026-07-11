import type { IndicatorKey } from '../indicators/Indicators';
import type { Coord } from '../types';

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
  /** Piso do final "Mestre": todos os indicadores >= este valor no fim. */
  readonly masterThreshold: number;
  /** Dias de crescimento por estágio do cacaueiro (no ideal). */
  readonly daysPerCacaoStage: number;
  /** Dias até uma árvore nativa amadurecer e passar a gerar sombra. */
  readonly treeMaturityDays: number;
  /** Rendimento base de cacau fresco por colheita. */
  readonly cacaoBaseYield: number;
  /** Bônus de rendimento por árvore nativa PODADA adjacente ao cacaueiro. */
  readonly cacaoPrunedBonus: number;
  /**
   * Nativas MADURAS que já existem no mapa ao começar (cabruca "herdada").
   * Não custam energia/ouro nem aplicam deltas — são parte do cenário inicial.
   */
  readonly initialTrees: ReadonlyArray<Coord>;
  /** Custo de energia por ação. */
  readonly energyCost: {
    readonly plantTree: number;
    readonly plantCacao: number;
    readonly harvest: number;
    readonly prune: number;
    readonly replantTree: number;
  };
  /** Deltas de indicador aplicados por ação. */
  readonly deltas: {
    readonly plantTree: IndicatorDelta;
    readonly plantCacao: IndicatorDelta;
    readonly harvest: IndicatorDelta;
    /** Podar reduz a biodiversidade (a árvore fica estressada). */
    readonly prune: IndicatorDelta;
    /** Replantar/undo de nativa recém-plantada custa energia, sem bônus. */
    readonly replantTree: IndicatorDelta;
    /** Por unidade vendida. */
    readonly sellPerUnit: IndicatorDelta;
  };
  /** Deltas aplicados a cada "dormir" (ex.: custo de manutenção). */
  readonly dailyDecay: IndicatorDelta;
}

export const DEFAULT_BALANCE: BalanceConfig = {
  // Talhão largo para preencher a tela (13×8). Altura 8 mantém o encaixe
  // vertical (HUD no topo + hotbar embaixo); largura 13 usa quase toda a tela.
  gridWidth: 13,
  gridHeight: 8,
  slotCount: 9,
  startEnergy: 8,
  totalDays: 12,
  winThreshold: 40,
  // Final Mestre = "100% do potencial": exige os três indicadores bem acima do
  // piso de vitória. 80 mantém alcançável em 12 dias (comunidade sobe devagar).
  masterThreshold: 80,
  // Cacaueiro: Muda → Jovem → Crescendo → Maduro. Com 1 dia/estágio o ciclo é
  // curto (cozy), próximo da tabela do design (~4 dias). O estágio "crescendo"
  // faz o papel da floração improdutiva; ficará mais fiel no refactor de Crop.
  daysPerCacaoStage: 1,
  // Nativa leva 10 dias para amadurecer (design atualizado). É por isso que o
  // mapa já nasce com nativas maduras e a bananeira dá sombra provisória.
  treeMaturityDays: 10,
  // Zonas de "sombra ideal" prontas no início, espalhadas pelo talhão largo
  // para não se sobreporem (nenhum tile nasce em mata fechada por causa delas).
  initialTrees: [
    { x: 2, y: 1 },
    { x: 6, y: 2 },
    { x: 10, y: 1 },
    { x: 3, y: 6 },
    { x: 8, y: 5 },
    { x: 11, y: 6 },
  ],
  // Colheita: 1 cacau fresco por padrão; cada nativa PODADA vizinha soma +1
  // (poda troca sombra/biodiversidade por produtividade — ver Farm.harvest).
  cacaoBaseYield: 1,
  cacaoPrunedBonus: 1,
  energyCost: {
    plantTree: 1,
    plantCacao: 1,
    harvest: 1,
    prune: 1,
    replantTree: 2,
  },
  deltas: {
    // Plantar nativa fortalece a biodiversidade.
    plantTree: { biodiversidade: 3 },
    // Diversificar cultivo ajuda um pouco a biodiversidade.
    plantCacao: { biodiversidade: 1 },
    // Colher gera valor (pequeno) na economia.
    harvest: { economia: 1 },
    // Podar estressa a árvore e reduz a biodiversidade (número de teste).
    prune: { biodiversidade: -2 },
    replantTree: {},
    // Vender: economia sobe; vender/escoar à comunidade dá um bônus menor.
    sellPerUnit: { economia: 4, comunidade: 1 },
  },
  // Custo de manutenção diário: sem vender, a economia sangra — cria a pressão
  // que torna o loop (colher → vender) necessário.
  dailyDecay: { economia: -2 },
};

export const ITEM_CACAU_FRESCO = 'cacau_fresco';
