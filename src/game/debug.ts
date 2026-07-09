/**
 * Flags de DEBUG do adapter, resolvidas em tempo de build via env do Vite.
 * Não são regra de jogo — apenas ligam/desligam visualizações auxiliares.
 *
 * `GRID_DEBUG` liga a visualização da GRADE DE SOMBRA (tints de sombra ideal /
 * mata fechada, aviso de sol pleno, contorno do talhão). No gameplay normal
 * essas camadas ficam invisíveis — as REGRAS do ShadeGrid continuam valendo,
 * só o overlay some. Para QA, defina `VITE_GRID_DEBUG=true` (veja `.env.example`).
 */
export const GRID_DEBUG =
  import.meta.env.VITE_GRID_DEBUG === 'true' || import.meta.env.VITE_GRID_DEBUG === '1';
