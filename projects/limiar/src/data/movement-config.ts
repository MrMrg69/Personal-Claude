import type { MovementConfig } from '@/core/physics/movement-config';
import { keepLive } from './hot-config';

/**
 * Física do movimento (design §5.1). Objeto MUTÁVEL: HMR e o painel de tuning
 * alteram os campos in-place; sistemas leem `cfg.movement.x` no momento do uso.
 * keepLive mantém a referência entre edições (ver hot-config.ts).
 */
export const MOVEMENT: MovementConfig = keepLive(import.meta.hot, 'movement', {
  capsuleRadius: 0.4,
  capsuleHeight: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 6.0,
  sprintSpeed: 8.5,
  groundAccel: 60,
  groundDecel: 80,
  airAccel: 12,
  airMaxSpeed: 6.0,
  gravity: -24,
  jumpHeight: 1.4,
  jumpHoldGravityScale: 0.5,
  jumpHoldDeadTime: 0.08,
  jumpHoldMaxTime: 0.25,
  maxFallSpeed: -40,
  coyoteTime: 0.1,
  jumpBufferTime: 0.1,
  slopeLimitDeg: 46,
  stepHeight: 0.35,
  // m. ≥ stepHeight + queda por passo no limite de rampa em sprint (0,35 + 8,5/60·tan 46° ≈ 0,50
  // seria o teto seguro; 0,40 cobre o Campo de Provas e ainda não gruda ao sair de um caixote de 1 m).
  groundSnapDistance: 0.4,
});

/** Limiares derivados do movimento (locomotion-state, kill-plane). */
export const LOCOMOTION = {
  /** m/s; abaixo disto no chão o estado é 'idle'. */
  idleSpeed: 0.1,
} as const;

export const RESPAWN = {
  /** s de chão caminhável contínuo entre amostras de lastSafePosition (kill plane). */
  safeGroundedSeconds: 1,
} as const;

// Auto-aceita: o servidor do Vite lê esta chamada no fonte; a cópia é feita por keepLive.
if (import.meta.hot) import.meta.hot.accept();
