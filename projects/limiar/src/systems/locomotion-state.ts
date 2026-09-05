import { SPRINT_MIN_FORWARD } from '@/core/physics/capsule-body';
import { LOCOMOTION } from '@/data/movement-config';
import type { Locomotion } from '@/entities/player';
import type { System } from './system';

/**
 * Fixed #4 (design §4.2): deriva player.locomotion de grounded/velocidade/
 * intenção de sprint (mesmo critério de integrateCapsuleBody) e emite
 * player:locomotionChanged. Dispersão (M1) e FOV dinâmico leem daqui.
 */
export function createLocomotionStateSystem(): System {
  return {
    name: 'locomotion-state',
    fixedUpdate(world) {
      const p = world.player;
      const v = p.body.velocity;
      const speed = Math.hypot(v.x, v.z);
      let next: Locomotion;
      if (!p.body.grounded) next = 'air';
      else if (speed < LOCOMOTION.idleSpeed) next = 'idle';
      else if (p.intent.sprint && p.intent.dir.y > SPRINT_MIN_FORWARD) next = 'sprint';
      else next = 'walk';
      if (next === p.locomotion) return;
      const from = p.locomotion;
      p.locomotion = next;
      world.events.emit('player:locomotionChanged', { from, to: next });
    },
  };
}
