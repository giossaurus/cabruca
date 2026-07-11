/**
 * Tokens de UI — camada ADAPTER (Phaser). Fonte única de cor/fonte/spacing para
 * todos os widgets em `src/game/ui/` e cenas. Extraídos da paleta já usada no
 * jogo (verde cozy, pastéis de mata/cabana e acentos de cacau). Cores em dois formatos:
 * `0x…` (number) para GameObjects de forma; `'#…'` (string) para Text.
 */
export const UI = {
  font: 'monospace',

  color: {
    // Fundos / overlays
    bgMenu: 0x243c2e,
    bgHotbar: 0x22372b,
    overlay: 0x132319,
    // Painéis / botões
    panel: 0x36543d,
    panelHover: 0x476a4f,
    panelDown: 0x2b4232,
    panelDisabled: 0x3b463f,
    stroke: 0xb7cf9d,
    strokeSoft: 0x78916d,
    // Barras
    barBg: 0x22372b,
    // Acentos
    primary: 0xcfe8a9,
    primaryHover: 0xf1d38a,
    energy: 0xf1d38a,
    warn: 0xf28c74,
    harvest: 0xf6c76d,
    // Indicadores
    biodiversidade: 0x4e9e57,
    economia: 0xf2c14e,
    comunidade: 0x4e8fd0,
  },

  /** Cores de texto (strings CSS para Phaser.Text). */
  text: {
    primary: '#fff7df',
    secondary: '#d7cda9',
    soft: '#f2e8c9',
    help: '#c8d6ad',
    muted: '#b4aa8c',
    onPrimary: '#243623',
    accent: '#f1d38a',
    warn: '#f28c74',
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
