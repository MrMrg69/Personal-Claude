import type { CapsuleBody, MoveIntent } from '@/core/physics/capsule-body';
import type { PlayerEntity } from './player';
import type { StaticWorldEntity } from './static-world';

export type { PlayerEntity, Locomotion } from './player';
export { createPlayer } from './player';
export type { StaticWorldEntity } from './static-world';
export { createStaticWorld } from './static-world';

/** União discriminada; cresce a cada kind novo (M2+: | EnemyEntity | ProjectileEntity | LootEntity). */
export type AnyEntity = PlayerEntity | StaticWorldEntity;
export type EntityKind = AnyEntity['kind'];

/** Todos os kinds, para sistemas iterarem por `ofKind` sem alocar iteradores no hot path. */
export const ENTITY_KINDS: readonly EntityKind[] = ['player', 'static'];

/** Composição transversal por interface + type guard, nunca por herança (design §3.1). */
export interface HasCapsuleBody {
  body: CapsuleBody;
  intent: MoveIntent;
}

/** character-physics move toda entidade que passe aqui (jogador hoje, inimigos em M2). */
export function hasBody(e: AnyEntity): e is AnyEntity & HasCapsuleBody {
  return 'body' in e;
}
