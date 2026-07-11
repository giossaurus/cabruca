/**
 * Save da PARTIDA — distinto das preferências (ver ui/settings.ts). Camada
 * ADAPTER: serializa/desserializa o agregado `Farm` em localStorage, com o mesmo
 * padrão defensivo do settings (try/catch, validação de versão/shape).
 *
 * Slot único (autosave). No Electron o localStorage persiste no diretório de
 * userData do app e sobrevive a relaunch — não precisa de IPC nem arquivo.
 */
import { Farm, SAVE_VERSION, type FarmState } from '../domain';

const KEY = 'cabruca:save';

/** Há uma partida salva? (Barato — só checa a existência da chave.) */
export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

/** Serializa e grava a partida. Silencioso em ambientes sem localStorage. */
export function writeSave(farm: Farm): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(farm.toState()));
  } catch {
    // Ignora quota cheia / ambiente sem storage — o jogo continua jogável.
  }
}

/** Estado salvo, ou null se ausente, corrompido ou de versão incompatível. */
export function readSaveState(): FarmState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FarmState>;
    if (!parsed || parsed.version !== SAVE_VERSION) return null;
    // Guarda mínima de shape: sem estes campos não dá para reconstruir o Farm.
    if (!parsed.config || !parsed.grid || !parsed.inventory || !parsed.indicators || !parsed.cacaos) {
      return null;
    }
    if (typeof parsed.day !== 'number' || typeof parsed.energy !== 'number') return null;
    return parsed as FarmState;
  } catch {
    return null;
  }
}

/** Carrega a partida como um `Farm` pronto, ou null se não houver save válido. */
export function loadFarm(): Farm | null {
  const state = readSaveState();
  if (!state) return null;
  try {
    return Farm.fromState(state);
  } catch {
    return null; // save inconsistente — trata como inexistente.
  }
}

/** Apaga o save (nova partida / fim de jogo). */
export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignora.
  }
}
