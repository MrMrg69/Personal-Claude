import { clamp, damp, rad } from '@/core/math';
import { Spring } from '@/core/math/spring';
import type { FeelConfig } from '@/data/feel-config';
import type { System } from './system';

/** Abaixo disto a mudança de FOV não vale um updateProjectionMatrix. */
const FOV_EPSILON_DEG = 0.01;

/**
 * Frame #2 (design §4.2, §5.5): molas de kick de pouso e slot de recoil, FOV
 * dinâmico por locomotion e head-bob (se ligado) → world.headOffsets. Os
 * offsets são recalculados do zero a cada frame (nunca acumulam): cada
 * contribuição decai sozinha por mola ou damp.
 *
 * Slot de recoil: `recoilOffset` é o alvo da mola (a arma de M1 o desloca por
 * tiro; o F9 o desloca via camera:kick) e `recoveryDegPerSec` o traz de volta
 * a zero; a mola (ζ 0,55) segue o alvo com leve overshoot — é o "snap".
 */
export function createCameraFeelSystem(): System {
  const landPitch = new Spring(1, 1);
  const landY = new Spring(1, 1);
  const recoilPitch = new Spring(1, 1);
  const recoilYaw = new Spring(1, 1);
  const recoilBack = new Spring(1, 1);
  let recoilOffsetPitch = 0;
  let recoilOffsetYaw = 0;
  let landFovTimer = 0;
  let landFovAmp = 0;
  let fov = 0;
  let appliedFov = 0;
  let appliedAspect = 0;
  let bobPhase = 0;
  let bobAmp = 0;
  const unsubscribe: (() => void)[] = [];

  const applySpringParams = (feel: FeelConfig): void => {
    landPitch.zeta = landY.zeta = feel.landKick.zeta;
    landPitch.omega = landY.omega = feel.landKick.omega;
    recoilPitch.zeta = recoilYaw.zeta = recoilBack.zeta = feel.recoil.zeta;
    recoilPitch.omega = recoilYaw.omega = recoilBack.omega = feel.recoil.omega;
  };

  return {
    name: 'camera-feel',
    init(world) {
      fov = world.settings.hfovDeg;
      unsubscribe.push(
        world.events.on('player:landed', ({ fallSpeed }) => {
          const k = world.cfg.feel.landKick;
          const amp = clamp(fallSpeed / k.fallSpeedRef, 0, 1);
          // ζ/ω aplicados ANTES do impulso: kickToPeak calibra pelo ζ/ω correntes.
          applySpringParams(world.cfg.feel);
          // Pitch negativo = olhar para baixo (rotation.x da cabeça); a cabeça afunda.
          landPitch.kickToPeak(-amp * rad(k.pitchDeg));
          landY.kickToPeak(-amp * k.posY);
          landFovAmp = amp;
          landFovTimer = world.cfg.camera.landFovKickTime;
        }),
        world.events.on('camera:kick', (kick) => {
          applySpringParams(world.cfg.feel);
          recoilOffsetPitch += rad(kick.pitchDeg);
          recoilOffsetYaw += rad(kick.yawDeg);
          recoilBack.kickToPeak(kick.posBack);
        }),
      );
    },
    frameUpdate(world, dt) {
      const feel = world.cfg.feel;
      const cam = world.cfg.camera;
      const p = world.player;
      const out = world.headOffsets;

      // Parâmetros lidos no uso: HMR/painel valem no próximo frame.
      applySpringParams(feel);

      // Recuperação do recoil: o alvo volta a zero a velocidade constante.
      const recovery = rad(feel.recoil.recoveryDegPerSec) * dt;
      recoilOffsetPitch = recoilOffsetPitch > 0 ? Math.max(0, recoilOffsetPitch - recovery) : Math.min(0, recoilOffsetPitch + recovery);
      recoilOffsetYaw = recoilOffsetYaw > 0 ? Math.max(0, recoilOffsetYaw - recovery) : Math.min(0, recoilOffsetYaw + recovery);
      recoilPitch.target = recoilOffsetPitch;
      recoilYaw.target = recoilOffsetYaw;

      landPitch.step(dt);
      landY.step(dt);
      recoilPitch.step(dt);
      recoilYaw.step(dt);
      recoilBack.step(dt);

      // Head-bob (desligado por padrão): amplitude escala com a velocidade, zero no ar.
      const bob = feel.headBob;
      const v = p.body.velocity;
      const speedRatio = Math.hypot(v.x, v.z) / world.cfg.movement.walkSpeed;
      const bobTarget = bob.enabled && p.body.grounded ? Math.min(1, speedRatio) : 0;
      bobAmp = damp(bobAmp, bobTarget, bob.ampDampLambda, dt);
      if (bobAmp > 0) bobPhase += 2 * Math.PI * bob.hz * dt * Math.max(speedRatio, 1);
      const bobY = bob.ampY * Math.abs(Math.sin(bobPhase)) * bobAmp;
      const bobX = bob.ampX * Math.sin(bobPhase / 2) * bobAmp;
      const bobRoll = rad(bob.rollDeg) * Math.sin(bobPhase / 2) * bobAmp;

      out.pitch = landPitch.value + recoilPitch.value;
      out.yaw = recoilYaw.value;
      out.roll = bobRoll;
      out.x = bobX;
      out.y = landY.value + bobY;
      out.back = recoilBack.value;

      // FOV dinâmico: sprint alarga, pouso encolhe por um instante; damp exponencial.
      landFovTimer = Math.max(0, landFovTimer - dt);
      const sprintAdd = p.locomotion === 'sprint' ? cam.sprintFovAddDeg : 0;
      const landSub = landFovTimer > 0 ? cam.landFovKickDeg * landFovAmp : 0;
      fov = damp(fov, world.settings.hfovDeg + sprintAdd - landSub, cam.fovDampLambda, dt);
      const aspect = world.renderer.aspect;
      if (Math.abs(fov - appliedFov) > FOV_EPSILON_DEG || aspect !== appliedAspect) {
        world.rig.setHfov(fov, aspect);
        appliedFov = fov;
        appliedAspect = aspect;
      }
    },
    dispose() {
      for (const u of unsubscribe) u();
      unsubscribe.length = 0;
    },
  };
}
