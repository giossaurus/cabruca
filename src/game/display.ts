// Camada ADAPTER: aplica preferências de exibição (modo de tela e resolução) ao
// Phaser e ao container #app. No navegador a "resolução" limita a caixa do jogo
// (letterbox pela cor de fundo da página). Empacotado em Electron, a bridge
// window.cabruca redimensiona a janela real do SO — mesmas opções, efeito nativo.
import Phaser from 'phaser';
import type { DisplayMode, Settings } from './ui/settings';

export interface ResolutionOption {
  id: string;
  label: string;
  /** Ausente em 'auto' (segue a janela). */
  width?: number;
  height?: number;
}

export const RESOLUTIONS: readonly ResolutionOption[] = [
  { id: 'auto', label: 'Automático (janela)' },
  { id: '1280x720', label: '1280 × 720 (HD)', width: 1280, height: 720 },
  { id: '1600x900', label: '1600 × 900 (HD+)', width: 1600, height: 900 },
  { id: '1920x1080', label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { id: '2560x1440', label: '2560 × 1440 (QHD)', width: 2560, height: 1440 },
];

export const DISPLAY_MODE_LABEL: Record<DisplayMode, string> = {
  fit: 'Ajustar (barras)',
  fill: 'Preencher (sem barras)',
};

/** Bridge opcional exposta pelo preload do Electron. Ausente no navegador. */
interface DisplayBridge {
  setResolution?(width: number, height: number): void;
  setFullscreen?(on: boolean): void;
}

declare global {
  interface Window {
    cabruca?: DisplayBridge;
  }
}

export function resolutionOption(id: string): ResolutionOption {
  return RESOLUTIONS.find((r) => r.id === id) ?? RESOLUTIONS[0]!;
}

/**
 * Aplica modo de tela + resolução. Idempotente: pode ser chamada no boot e a
 * cada mudança nas opções.
 */
export function applyDisplaySettings(game: Phaser.Game, settings: Settings): void {
  const scale = game.scale;
  scale.scaleMode = settings.displayMode === 'fill' ? Phaser.Scale.RESIZE : Phaser.Scale.FIT;

  const res = resolutionOption(settings.resolution);
  const parent = document.getElementById('app');

  if (res.width && res.height) {
    // Electron: janela nativa no tamanho exato (efeito real de resolução).
    window.cabruca?.setResolution?.(res.width, res.height);
    // Navegador: limita a caixa do jogo; a página (preta) faz o letterbox em volta.
    if (parent) {
      parent.style.width = `${res.width}px`;
      parent.style.height = `${res.height}px`;
      parent.style.maxWidth = '100%';
      parent.style.maxHeight = '100%';
    }
  } else if (parent) {
    // 'auto': preenche a janela; o modo de tela decide se há barras.
    parent.style.width = '100%';
    parent.style.height = '100%';
    parent.style.maxWidth = '';
    parent.style.maxHeight = '';
  }

  // RESIZE só reflui quando o tamanho do parent muda; refresh força o recálculo.
  scale.refresh();
}
