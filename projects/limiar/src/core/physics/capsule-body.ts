import * as THREE from 'three';
import type { Transform } from '../entity';
import { moveTowardsVec2XZ } from '../math';
import type { CollisionMask } from './layers';
import type { MovementConfig } from './movement-config';

export interface CapsuleBody {
  radius: number;
  /** Altura total dos pés ao topo. */
  height: number;
  velocity: THREE.Vector3;
  grounded: boolean;
  groundNormal: THREE.Vector3;
  /** s; coyote time. */
  timeSinceGrounded: number;
  /** s; jump buffer. */
  jumpBufferTimer: number;
  /** s com o pulo segurado desde o salto. */
  jumpHoldTimer: number;
  /** Evita "pulo duplo" via coyote depois de já ter pulado. */
  airborneByJump: boolean;
  layer: CollisionMask;
  mask: CollisionMask;
}

export interface MoveIntent {
  /** (x = direita, y = frente) em [-1,1], espaço local do yaw. */
  dir: THREE.Vector2;
  /** rad; direção "frente". */
  yaw: number;
  sprint: boolean;
  /** Borda. */
  jumpPressed: boolean;
  /** Nível. */
  jumpHeld: boolean;
}

export function createCapsuleBody(cfg: MovementConfig, layer: CollisionMask, mask: CollisionMask): CapsuleBody {
  return {
    radius: cfg.capsuleRadius,
    height: cfg.capsuleHeight,
    velocity: new THREE.Vector3(),
    grounded: false,
    groundNormal: new THREE.Vector3(0, 1, 0),
    timeSinceGrounded: 0,
    jumpBufferTimer: 0,
    jumpHoldTimer: 0,
    airborneByJump: false,
    layer,
    mask,
  };
}

export function createMoveIntent(): MoveIntent {
  return { dir: new THREE.Vector2(), yaw: 0, sprint: false, jumpPressed: false, jumpHeld: false };
}

/** Sprint só vale empurrando para a frente de verdade (não em strafe puro). locomotion-state usa o mesmo critério. */
export const SPRINT_MIN_FORWARD = 0.5;

/**
 * Velocidade inicial do salto com correção de discretização: em Euler
 * semi-implícito a altura real fica ~v0·dt/2 abaixo da analítica.
 * √(2·|g|·h) + |g|·dt/2 (design §5.1).
 */
export function jumpSpeedFor(cfg: MovementConfig, dt: number): number {
  const g = Math.abs(cfg.gravity);
  return Math.sqrt(2 * g * cfg.jumpHeight) + (g * dt) / 2;
}

/**
 * Integra um passo fixo (design §5.1, passos 1–5). Função pura: sem colisão,
 * sem alocação. O chamador passa depois por resolveCapsuleCollision.
 */
export function integrateCapsuleBody(
  t: Transform,
  body: CapsuleBody,
  intent: MoveIntent,
  cfg: MovementConfig,
  dt: number,
  out: { jumped: boolean },
): void {
  out.jumped = false;
  const vel = body.velocity;

  // 1. Timers.
  if (!body.grounded) body.timeSinceGrounded += dt;
  body.jumpBufferTimer = Math.max(0, body.jumpBufferTimer - dt);
  if (intent.jumpPressed) body.jumpBufferTimer = cfg.jumpBufferTime;

  // 2. Horizontal. forward = (−sin yaw, 0, −cos yaw); right = (cos yaw, 0, −sin yaw).
  const sinYaw = Math.sin(intent.yaw);
  const cosYaw = Math.cos(intent.yaw);
  let dirX = intent.dir.x;
  let dirY = intent.dir.y;
  const dirLen = Math.hypot(dirX, dirY);
  if (dirLen > 1) {
    dirX /= dirLen;
    dirY /= dirLen;
  }
  const wishX = cosYaw * dirX - sinYaw * dirY;
  const wishZ = -sinYaw * dirX - cosYaw * dirY;
  const hasInput = dirLen > 0;
  const sprinting = intent.sprint && dirY > SPRINT_MIN_FORWARD;
  let speed = sprinting ? cfg.sprintSpeed : cfg.walkSpeed;

  if (body.grounded) {
    const accel = hasInput ? cfg.groundAccel : cfg.groundDecel;
    moveTowardsVec2XZ(vel, wishX * speed, wishZ * speed, accel * dt);
  } else if (hasInput) {
    // No ar sem input a velocidade horizontal não decai (sem atrito aéreo).
    speed = Math.min(speed, cfg.airMaxSpeed);
    moveTowardsVec2XZ(vel, wishX * speed, wishZ * speed, cfg.airAccel * dt);
  }

  // 3. Pulo (com buffer e coyote; coyote não vale depois de já ter pulado).
  const canJump = body.grounded || (body.timeSinceGrounded <= cfg.coyoteTime && !body.airborneByJump);
  if (body.jumpBufferTimer > 0 && canJump) {
    vel.y = jumpSpeedFor(cfg, dt);
    body.grounded = false;
    body.airborneByJump = true;
    body.jumpBufferTimer = 0;
    body.jumpHoldTimer = 0;
    out.jumped = true;
  }

  // 4. Vertical: segurar o pulo reduz a gravidade na subida por um tempo limitado.
  const holdActive = body.airborneByJump && intent.jumpHeld && vel.y > 0 && body.jumpHoldTimer < cfg.jumpHoldMaxTime;
  if (holdActive) body.jumpHoldTimer += dt;
  const g = cfg.gravity * (holdActive ? cfg.jumpHoldGravityScale : 1);
  vel.y = Math.max(vel.y + g * dt, cfg.maxFallSpeed);

  // 5. Posição (a colisão corrige depois).
  t.prevPosition.copy(t.position);
  t.position.addScaledVector(vel, dt);
}
