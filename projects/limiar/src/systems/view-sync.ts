import { ENTITY_KINDS } from '@/entities';
import type { System } from './system';

/**
 * Frame #3 (design §4.2): posição renderizada = lerp(prev, pos, alpha) para
 * toda entidade com `view`. Único lugar (com camera-sync) que escreve em
 * Object3D a partir da simulação.
 */
export function createViewSyncSystem(): System {
  return {
    name: 'view-sync',
    frameUpdate(world, _dt, alpha) {
      for (let k = 0; k < ENTITY_KINDS.length; k++) {
        const kind = ENTITY_KINDS[k];
        if (kind === undefined) continue;
        const list = world.entities.ofKind(kind);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (!e || !e.view) continue;
          e.view.position.lerpVectors(e.transform.prevPosition, e.transform.position, alpha);
          e.view.rotation.y = e.transform.yaw;
        }
      }
    },
  };
}
