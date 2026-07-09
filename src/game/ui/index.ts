// Barrel do módulo de UI nativa (camada ADAPTER). Widgets desenhados com
// rectangle+text monospace, reusando os tokens de `theme.ts`.
export { UI, hex } from './theme';
export { Button } from './Button';
export type { ButtonConfig, ButtonVariant } from './Button';
export { Slider } from './Slider';
export type { SliderConfig } from './Slider';
export { Toggle } from './Toggle';
export type { ToggleConfig } from './Toggle';
export { StatBar } from './StatBar';
export type { StatBarConfig } from './StatBar';
export { Panel } from './Panel';
export type { PanelConfig } from './Panel';
export { loadSettings, saveSettings } from './settings';
export type { Settings } from './settings';
