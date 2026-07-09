/**
 * Tokens de UI — camada ADAPTER (Phaser). Fonte única de cor/fonte/spacing para
 * todos os widgets em `src/game/ui/` e cenas. Extraídos da paleta já usada no
 * jogo (cozy, floresta escura, acentos de cacau). Cores em dois formatos:
 * `0x…` (number) para GameObjects de forma; `'#…'` (string) para Text.
 */
export const UI = {
  font: 'monospace',

  color: {
    // Fundos / overlays
    bgMenu: 0x14251a,
    bgHotbar: 0x11201a,
    overlay: 0x05100a,
    // Painéis / botões
    panel: 0x1d3a24,
    panelHover: 0x2a4d33,
    panelDown: 0x162b1c,
    panelDisabled: 0x1a2620,
    stroke: 0x3f7a2e,
    strokeSoft: 0x3a5a3f,
    // Barras
    barBg: 0x142519,
    // Acentos
    primary: 0x7bd06a,
    primaryHover: 0x8fdd7c,
    energy: 0xe6c34a,
    warn: 0xff5a3c,
    harvest: 0xffd34a,
    // Indicadores
    biodiversidade: 0x4e9e57,
    economia: 0xf2c14e,
    comunidade: 0x4e8fd0,
  },

  /** Cores de texto (strings CSS para Phaser.Text). */
  text: {
    primary: '#e8f3e6',
    secondary: '#8fb593',
    soft: '#cfe3cf',
    help: '#7ba081',
    muted: '#5f7d64',
    onPrimary: '#0d1f13',
    accent: '#7bd06a',
    warn: '#ff6a4d',
  },

  size: {
    title: '44px',
    heading: '26px',
    button: '20px',
    body: '15px',
    small: '13px',
    tiny: '11px',
  },
} as const;

/** Converte um número 0xRRGGBB para string CSS '#rrggbb' (Text usa string). */
export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
