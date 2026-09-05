import type * as THREE from 'three';
import type { Capsule } from 'three/addons/math/Capsule.js';
import type { EntityId } from '../entity';
import type { CollisionMask } from './layers';

/** Resultado de capsuleIntersect: empurrar a cápsula por `normal · depth` a tira do contato. */
export interface CapsuleHit {
  normal: THREE.Vector3;
  depth: number;
}

export interface RayHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  layer: CollisionMask;
  /** Entidade dona da hitbox atingida; null para o mundo estático. */
  entity: EntityId | null;
}

/**
 * O que a resolução de colisão (core) precisa do mundo (world/collision-world.ts
 * implementa sobre Octree + hitboxes). Manter a interface aqui permite testar
 * core/physics com um mundo sintético e trocar a implementação (ex.: BVH).
 */
export interface CollisionQuery {
  capsuleIntersect(c: Capsule, out: CapsuleHit): boolean;
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, mask: CollisionMask, out: RayHit): boolean;
}
