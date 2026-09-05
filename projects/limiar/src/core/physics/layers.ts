/**
 * Camadas de colisão como bitmask (design §5.2). Objeto `as const` em vez de
 * `const enum` porque o projeto compila com isolatedModules/verbatimModuleSyntax.
 */
export const CollisionLayer = {
  None: 0,
  World: 1,
  Player: 2,
  Enemy: 4,
  Projectile: 8,
  Pickup: 16,
  All: 0xffff,
} as const;

/** Um valor nomeado de CollisionLayer. */
export type CollisionLayer = (typeof CollisionLayer)[keyof typeof CollisionLayer];

/** Combinação (OR) de camadas; usado em `mask` e em consultas. */
export type CollisionMask = number;
