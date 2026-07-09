import { type Coord, coordKey, MOORE_NEIGHBORS } from '../types';
import { ShadeGrid, type ShadeStatus } from '../shade/ShadeGrid';
import { Cacao, type CacaoStage } from '../crop/Cacao';
import { Inventory, type Slot } from '../inventory/Inventory';
import { Indicators, type IndicatorKey } from '../indicators/Indicators';
import {
  DEFAULT_BALANCE,
  ITEM_CACAU_FRESCO,
  type BalanceConfig,
  type IndicatorDelta,
} from './balance';

export type GamePhase = 'jogando' | 'vitoria' | 'derrota';

/** Visão de um tile para render (o adapter nunca acessa o estado interno). */
export interface TileView {
  readonly x: number;
  readonly y: number;
  readonly kind: 'empty' | 'tree' | 'cacao';
  /** Só para árvore: já é madura (gera sombra)? */
  readonly matureTree: boolean;
  /** Só para árvore: foi podada (continua existindo, mas não gera sombra)? */
  readonly pruned: boolean;
  readonly shadeLevel: number;
  readonly shadeStatus: ShadeStatus;
  /** Só para cacau. */
  readonly cacao?: {
    readonly stage: CacaoStage;
    readonly dead: boolean;
    readonly harvestable: boolean;
  };
}

export interface FarmSnapshot {
  readonly day: number;
  readonly totalDays: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly phase: GamePhase;
  readonly indicators: Record<IndicatorKey, number>;
  readonly inventory: ReadonlyArray<Slot | null>;
  readonly tiles: ReadonlyArray<TileView>;
}

interface CacaoCell {
  readonly coord: Coord;
  readonly cacao: Cacao;
}

/** Multiplica um delta de indicador por um fator (ex.: vender N unidades). */
function scaleDelta(delta: IndicatorDelta, factor: number): IndicatorDelta {
  const out: IndicatorDelta = {};
  for (const key of Object.keys(delta) as IndicatorKey[]) {
    const v = delta[key];
    if (v !== undefined) out[key] = v * factor;
  }
  return out;
}

/**
 * Orquestrador de turno — o AGREGADO do jogo. Junta as quatro peças de domínio
 * (sombra, cacau, inventário, indicadores) e é a ÚNICA fonte da verdade.
 *
 * O adapter Phaser guarda uma instância, chama as ações e redesenha a partir de
 * `snapshot()`. Nenhuma regra mora fora daqui (ADR 0002).
 *
 * Loop central: agir gastando energia → `sleep()` avança um dia (cacau cresce
 * conforme a sombra, energia recarrega, manutenção diária é cobrada) → repetir
 * até a condição de vitória/derrota por equilíbrio dos três indicadores.
 */
export class Farm {
  readonly config: BalanceConfig;
  readonly grid: ShadeGrid;
  readonly inventory: Inventory;
  readonly indicators: Indicators;

  private readonly cacaos = new Map<string, CacaoCell>();
  private _energy: number;
  private _day = 1;
  private _phase: GamePhase = 'jogando';

  constructor(config: Partial<BalanceConfig> = {}) {
    this.config = { ...DEFAULT_BALANCE, ...config };
    this.grid = new ShadeGrid(
      this.config.gridWidth,
      this.config.gridHeight,
      this.config.treeMaturityDays,
    );
    this.inventory = new Inventory(this.config.slotCount);
    this.indicators = new Indicators();
    this._energy = this.config.startEnergy;
    // Cabruca herdada: nativas já maduras no cenário inicial (sem custo/deltas).
    for (const c of this.config.initialTrees) {
      this.grid.plantTree(c, this.config.treeMaturityDays);
    }
  }

  get day(): number {
    return this._day;
  }

  get energy(): number {
    return this._energy;
  }

  get maxEnergy(): number {
    return this.config.startEnergy;
  }

  get phase(): GamePhase {
    return this._phase;
  }

  // ─── Ações ────────────────────────────────────────────────────────────────

  /** Planta uma árvore nativa. Fortalece a biodiversidade. */
  plantTree(c: Coord): boolean {
    const cost = this.config.energyCost.plantTree;
    if (!this.canPlantAt(c, cost)) return false;
    this.grid.plantTree(c);
    this.spend(cost);
    this.indicators.apply(this.config.deltas.plantTree);
    return true;
  }

  /** Planta um cacaueiro e cria sua instância de ciclo de vida. */
  plantCacao(c: Coord): boolean {
    const cost = this.config.energyCost.plantCacao;
    if (!this.canPlantAt(c, cost)) return false;
    this.grid.plantCacao(c);
    this.cacaos.set(coordKey(c), {
      coord: { x: c.x, y: c.y },
      cacao: new Cacao(this.config.daysPerCacaoStage),
    });
    this.spend(cost);
    this.indicators.apply(this.config.deltas.plantCacao);
    return true;
  }

  /**
   * Colhe um cacaueiro maduro: gera cacau fresco e libera o tile.
   * Rendimento = base + bônus por cada nativa PODADA adjacente (produtividade).
   */
  harvest(c: Coord): boolean {
    const cost = this.config.energyCost.harvest;
    if (this._phase !== 'jogando' || this._energy < cost) return false;
    const cell = this.cacaos.get(coordKey(c));
    if (!cell || !cell.cacao.harvestable) return false;
    const yield_ =
      this.config.cacaoBaseYield +
      this.config.cacaoPrunedBonus * this.countPrunedNeighbors(c);
    // Inventário cheio: não colhe (regra do Inventory — item não coletável).
    if (this.inventory.add(ITEM_CACAU_FRESCO, yield_) === 0) return false;
    this.grid.remove(c);
    this.cacaos.delete(coordKey(c));
    this.spend(cost);
    this.indicators.apply(this.config.deltas.harvest);
    return true;
  }

  /**
   * Poda uma nativa madura: deixa de gerar sombra (a árvore continua no tile),
   * custa energia e reduz a biodiversidade. Não re-poda uma já podada.
   */
  prune(c: Coord): boolean {
    const cost = this.config.energyCost.prune;
    if (this._phase !== 'jogando' || this._energy < cost) return false;
    if (!this.grid.isMatureTree(c) || this.grid.isPrunedTree(c)) return false;
    this.grid.prune(c);
    this.spend(cost);
    this.indicators.apply(this.config.deltas.prune);
    return true;
  }

  /**
   * Vende itens do inventário. Não custa energia. Move Economia (e Comunidade).
   * Retorna quantas unidades foram efetivamente vendidas.
   */
  sell(itemId: string, qty = 1): number {
    if (this._phase !== 'jogando') return 0;
    const sold = this.inventory.remove(itemId, qty);
    if (sold > 0) {
      this.indicators.apply(scaleDelta(this.config.deltas.sellPerUnit, sold));
    }
    return sold;
  }

  /**
   * "Dormir": avança um dia em todo o mundo.
   *  - envelhece árvores (via ShadeGrid) e cresce cada cacaueiro pela sombra atual;
   *  - cobra a manutenção diária;
   *  - recarrega a energia;
   *  - reavalia a condição de fim.
   */
  sleep(): void {
    if (this._phase !== 'jogando') return;
    this.grid.advanceDay();
    for (const { coord, cacao } of this.cacaos.values()) {
      cacao.advanceDay(this.grid.shadeLevelAt(coord));
    }
    this.indicators.apply(this.config.dailyDecay);
    this._energy = this.config.startEnergy;
    this._day++;
    this.evaluatePhase();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  snapshot(): FarmSnapshot {
    const tiles: TileView[] = [];
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const c = { x, y };
        const tile = this.grid.tileAt(c);
        const cell = this.cacaos.get(coordKey(c));
        tiles.push({
          x,
          y,
          kind: tile.kind,
          matureTree: this.grid.isMatureTree(c),
          pruned: this.grid.isPrunedTree(c),
          shadeLevel: this.grid.shadeLevelAt(c),
          shadeStatus: this.grid.shadeStatusAt(c),
          ...(cell
            ? {
                cacao: {
                  stage: cell.cacao.stage,
                  dead: cell.cacao.dead,
                  harvestable: cell.cacao.harvestable,
                },
              }
            : {}),
        });
      }
    }
    return {
      day: this._day,
      totalDays: this.config.totalDays,
      energy: this._energy,
      maxEnergy: this.config.startEnergy,
      phase: this._phase,
      indicators: this.indicators.snapshot(),
      inventory: this.inventory.slots(),
      tiles,
    };
  }

  // ─── Internos ───────────────────────────────────────────────────────────────

  /** Quantas nativas PODADAS existem nos 8 vizinhos (bônus de produtividade). */
  private countPrunedNeighbors(c: Coord): number {
    let n = 0;
    for (const d of MOORE_NEIGHBORS) {
      const v = { x: c.x + d.x, y: c.y + d.y };
      if (this.grid.inBounds(v) && this.grid.isPrunedTree(v)) n++;
    }
    return n;
  }

  private canPlantAt(c: Coord, cost: number): boolean {
    return (
      this._phase === 'jogando' &&
      this._energy >= cost &&
      this.grid.inBounds(c) &&
      this.grid.isEmpty(c)
    );
  }

  private spend(cost: number): void {
    this._energy -= cost;
  }

  private evaluatePhase(): void {
    if (this.indicators.min() <= 0) {
      this._phase = 'derrota';
      return;
    }
    if (this._day > this.config.totalDays) {
      this._phase = this.indicators.allAbove(this.config.winThreshold)
        ? 'vitoria'
        : 'derrota';
    }
  }
}
