import * as THREE from 'three';
import { rad } from '@/core/math';
import { RESPAWN } from '@/data/movement-config';
import type { GameEvents } from '@/game/events';
import type { World } from '@/game/world';
import type { System } from './system';

/**
 * Coloca o jogador em (x, y, z) parado, no ar (o primeiro passo cola no chão
 * se houver). timeSinceGrounded = coyoteTime evita um pulo "grátis" ao chegar.
 * Usado por respawn, teleporte de debug e testes.
 */
export function placePlayer(world: World, x: number, y: number, z: number): void {
  const p = world.player;
  const body = p.body;
  p.transform.position.set(x, y, z);
  p.transform.prevPosition.set(x, y, z);
  body.velocity.set(0, 0, 0);
  body.grounded = false;
  body.timeSinceGrounded = world.cfg.movement.coyoteTime;
  body.jumpBufferTimer = 0;
  body.jumpHoldTimer = 0;
  body.airborneByJump = false;
}

/**
 * 'killplane' → última posição segura (chão caminhável há ≥ 1 s);
 * 'debug' (tecla P / __limiar.respawn) → spawn do nível, olhando como no início.
 */
export function respawnPlayer(world: World, reason: GameEvents['player:respawned']['reason']): void {
  const p = world.player;
  if (reason === 'killplane') {
    const s = p.lastSafePosition;
    placePlayer(world, s.x, s.y, s.z);
  } else {
    const spawn = world.level.spawnPoints.find((sp) => sp.tag === 'player') ?? world.level.spawnPoints[0];
    if (!spawn) throw new Error(`kill-plane: nível '${world.level.id}' sem spawn`);
    placePlayer(world, spawn.pos[0], spawn.pos[1], spawn.pos[2]);
    p.look.yaw = rad(spawn.yawDeg);
    p.look.pitch = 0;
    p.transform.yaw = p.look.yaw;
    p.lastSafePosition.copy(p.transform.position);
  }
  world.events.emit('player:respawned', { reason });
}

/**
 * Fixed #3 (design §4.2): abaixo de level.killPlaneY → respawn em
 * lastSafePosition. A posição segura é amostrada a cada `safeGroundedSeconds`
 * de chão contínuo (não a cada passo) e com um estágio de atraso: a amostra
 * nova vira `candidate` e a anterior é promovida a lastSafePosition. Sem o
 * atraso, a amostra podia cair a centímetros da beirada (verificado: 22 cm)
 * e quem corre para fora voltava para a própria beirada; com ele, o ponto
 * seguro tem sempre ≥ 1 s de chão contínuo entre ele e a queda.
 */
export function createKillPlaneSystem(): System {
  let groundedTime = 0;
  const candidate = new THREE.Vector3();

  return {
    name: 'kill-plane',
    init(world) {
      groundedTime = 0;
      world.player.lastSafePosition.copy(world.player.transform.position);
      candidate.copy(world.player.transform.position);
    },
    fixedUpdate(world, dt) {
      const p = world.player;
      // grounded já implica normal caminhável (resolveCapsuleCollision só o liga assim).
      if (p.body.grounded) {
        groundedTime += dt;
        if (groundedTime >= RESPAWN.safeGroundedSeconds) {
          p.lastSafePosition.copy(candidate);
          candidate.copy(p.transform.position);
          groundedTime = 0;
        }
      } else {
        groundedTime = 0;
      }
      if (p.transform.position.y < world.level.killPlaneY) {
        respawnPlayer(world, 'killplane');
        candidate.copy(p.lastSafePosition);
        groundedTime = 0;
      }
    },
  };
}
