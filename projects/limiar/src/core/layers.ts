/**
 * Camadas de render (design §6.3). WORLD é renderizado pela câmera do mundo,
 * VIEWMODEL só pela câmera da arma (FOV próprio, sem atravessar paredes),
 * DEBUG é ligado/desligado na câmera do mundo com F6.
 */
export const Layer = {
  WORLD: 0,
  VIEWMODEL: 1,
  DEBUG: 2,
} as const;

export type Layer = (typeof Layer)[keyof typeof Layer];
