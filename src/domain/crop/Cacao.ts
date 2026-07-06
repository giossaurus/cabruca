/**
 * Ciclo de vida do cacaueiro em função do Nível de Sombra do seu tile.
 *
 * Regras (rascunhos_iniciais.md):
 *  - Sol Pleno (nível 0): estresse. Sem crescimento. 3 dias consecutivos => morre.
 *  - Ideal (nível 1): crescimento e produção normais.
 *  - Mata Fechada (nível 2+): estágio +1 dia mais lento.
 *
 * Modelo: cada estágio exige `baseDaysPerStage` dias de crescimento no ideal.
 * Se o cacaueiro passar por Mata Fechada durante o estágio, a exigência sobe
 * em +1 dia (uma vez por estágio — "+1 dia mais lento", não cumulativo).
 */

export const CACAO_STAGES = ['muda', 'jovem', 'crescendo', 'maduro'] as const;
export type CacaoStage = (typeof CACAO_STAGES)[number];

export const LAST_STAGE_INDEX = CACAO_STAGES.length - 1;
export const SOL_PLENO_DEATH_DAYS = 3;
export const DEFAULT_DAYS_PER_STAGE = 2;

export class Cacao {
  private stageIndex = 0;
  private progress = 0; // dias de crescimento acumulados no estágio atual
  private extraDaysThisStage = 0; // penalidade de mata fechada (0 ou 1)
  private consecutiveSolPleno = 0;
  private _dead = false;

  constructor(private readonly baseDaysPerStage: number = DEFAULT_DAYS_PER_STAGE) {}

  get stage(): CacaoStage {
    return CACAO_STAGES[this.stageIndex]!;
  }

  get dead(): boolean {
    return this._dead;
  }

  get harvestable(): boolean {
    return !this._dead && this.stageIndex === LAST_STAGE_INDEX;
  }

  /** Avança um dia dado o Nível de Sombra atual do tile do cacaueiro. */
  advanceDay(shadeLevel: number): void {
    if (this._dead || this.harvestable) return;

    // Sol Pleno: estresse, sem crescimento.
    if (shadeLevel === 0) {
      this.consecutiveSolPleno++;
      if (this.consecutiveSolPleno >= SOL_PLENO_DEATH_DAYS) {
        this._dead = true;
      }
      return;
    }

    this.consecutiveSolPleno = 0;

    // Mata Fechada: estágio fica 1 dia mais lento.
    if (shadeLevel >= 2) {
      this.extraDaysThisStage = 1;
    }

    this.progress++;
    const required = this.baseDaysPerStage + this.extraDaysThisStage;
    if (this.progress >= required && this.stageIndex < LAST_STAGE_INDEX) {
      this.stageIndex++;
      this.progress = 0;
      this.extraDaysThisStage = 0;
    }
  }

  /** Estado serializável (para save/render). */
  snapshot() {
    return {
      stage: this.stage,
      stageIndex: this.stageIndex,
      progress: this.progress,
      dead: this._dead,
      harvestable: this.harvestable,
      consecutiveSolPleno: this.consecutiveSolPleno,
    } as const;
  }
}
