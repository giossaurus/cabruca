/**
 * Registro único das faixas de profundidade da UI/overlays. O mundo ordena por
 * Y (depth ≈ y, até ~WORLD_H); tudo aqui fica acima dele, na ordem: fog cobre o
 * mundo → hotbar/HUD/ajuda sobre o fog → overlays de fim/modal → transição.
 */
export const DEPTH = {
  fog: 1400,
  slotbar: 1450,
  hud: 1500,
  help: 1600,
  end: 2000,
  modal: 3000,
  modalContent: 3001,
  transition: 5000,
} as const;
