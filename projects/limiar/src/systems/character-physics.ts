import { integrateCapsuleBody } from '@/core/physics/capsule-body';
import { resolveCapsuleCollision, type CollisionResolveResult } from '@/core/physics/collision-resolve';
import { ENTITY_KINDS, hasBody } from '@/entities';
import type { System } from './system';

/**
 * Fixed #2 (design §4.2): para TODA entidade com `body` (jogador hoje,
 * inimigos cinemáticos em M2 — a IA só escreve `intent`), integra e resolve
 * colisão. Eventos player:jumped/landed só para o jogador.
 */
export function createCharacterPhysicsSystem(): System {
  const jumped = { jumped: false };
  const resolved: CollisionResolveResult = { landed: false, fallSpeed: 0 };

  return {
    name: 'character-physics',
    fixedUpdate(world, dt) {
      const cfg = world.cfg.movement;
      for (let k = 0; k < ENTITY_KINDS.length; k++) {
        const kind = ENTITY_KINDS[k];
        if (kind === undefined) continue;
        const list = world.entities.ofKind(kind);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (!e || !e.alive || !hasBody(e)) continue;
          const fromGround = e.body.grounded;
          integrateCapsuleBody(e.transform, e.body, e.intent, cfg, dt, jumped);
          resolveCapsuleCollision(e.transform, e.body, world.collision, cfg, resolved);
          if (e.kind !== 'player') continue;
          if (jumped.jumped) world.events.emit('player:jumped', { fromGround });
          if (resolved.landed) world.events.emit('player:landed', { fallSpeed: resolved.fallSpeed });
        }
      }
    },
  };
}
