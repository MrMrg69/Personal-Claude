import * as THREE from 'three';
import { allocEntityId, type EntityBase } from '@/core/entity';
import type { LevelDef } from '@/data/levels/level-def';
import { buildLevel, type BuiltLevel } from '@/world/level-builder';

/** O mundo estático como entidade: um só Group mesclado (design §3.3). */
export interface StaticWorldEntity extends EntityBase {
  readonly kind: 'static';
  /** = built.staticRoot; adicione à cena. */
  root: THREE.Group;
  built: BuiltLevel;
  level: LevelDef;
  view: THREE.Group;
}

export function createStaticWorld(level: LevelDef): StaticWorldEntity {
  const built = buildLevel(level);
  return {
    id: allocEntityId(),
    kind: 'static',
    alive: true,
    transform: { position: new THREE.Vector3(), prevPosition: new THREE.Vector3(), yaw: 0 },
    root: built.staticRoot,
    built,
    level,
    view: built.staticRoot,
  };
}
