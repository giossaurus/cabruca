/**
 * Identidade do jogador (apelido + pronome), persistida em localStorage. Camada
 * ADAPTER, no mesmo molde de `settings.ts`: não é regra de jogo. O pronome
 * flexiona textos narrativos (ex.: o título final na carta de intro).
 */
export type Pronoun = 'ele' | 'ela' | 'elu';

export interface PlayerProfile {
  nickname: string;
  pronoun: Pronoun;
}

const KEY = 'cabruca:profile';

const DEFAULTS: PlayerProfile = {
  nickname: '',
  pronoun: 'elu',
};

function pronoun(v: unknown): Pronoun {
  return v === 'ele' || v === 'ela' || v === 'elu' ? v : DEFAULTS.pronoun;
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : DEFAULTS.nickname,
      pronoun: pronoun(parsed.pronoun),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveProfile(p: PlayerProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignora ambientes sem localStorage
  }
}

/** Título final da carta, flexionado pelo pronome escolhido. */
export function masterTitle(p: Pronoun): string {
  switch (p) {
    case 'ele':
      return 'Mestre Fazendeiro';
    case 'ela':
      return 'Mestra Fazendeira';
    case 'elu':
      return 'Mestre Fazendeire';
  }
}

/** Título da vitória padrão, flexionado pelo pronome escolhido. */
export function prosperousTitle(p: Pronoun): string {
  switch (p) {
    case 'ele':
      return 'Fazendeiro Próspero';
    case 'ela':
      return 'Fazendeira Próspera';
    case 'elu':
      return 'Fazendeire Próspere';
  }
}

/** "um fazendeiro exemplar", flexionado — usado no texto do final Mestre. */
export function exemplaryFarmer(p: Pronoun): string {
  switch (p) {
    case 'ele':
      return 'um fazendeiro exemplar';
    case 'ela':
      return 'uma fazendeira exemplar';
    case 'elu':
      return 'ume fazendeire exemplar';
  }
}
