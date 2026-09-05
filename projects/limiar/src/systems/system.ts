import type { World } from '@/game/world';

/**
 * Sistema (design §3.1): objeto sem estado de entidades (só caches próprios),
 * registrado na lista ordenada única de game/systems-list.ts. fixedUpdate roda
 * 0..N vezes por frame a 60 Hz; frameUpdate 1x por frame na taxa do monitor.
 */
export interface System {
  readonly name: string;
  init?(world: World): void;
  fixedUpdate?(world: World, dt: number): void;
  frameUpdate?(world: World, dt: number, alpha: number): void;
  dispose?(world: World): void;
}
