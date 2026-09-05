import * as THREE from 'three';
import { clamp, rad } from '@/core/math';
import type { System } from './system';

const TWO_PI = Math.PI * 2;
const delta = new THREE.Vector2();

/**
 * Frame #1 (design §4.2, §5.4): mouse → look.yaw/pitch na taxa do monitor
 * (sem latência de interpolação). Sensibilidade em graus por contagem ×
 * multiplicador do usuário; sem suavização nem aceleração. Fora de 'running'
 * ou em modo de tuning o delta é consumido e descartado (mouse sobre o
 * overlay/painel não gira a câmera).
 */
export function createPlayerLookSystem(): System {
  return {
    name: 'player-look',
    frameUpdate(world) {
      world.input.consumeMouseDelta(delta);
      const p = world.player;
      if (world.state === 'running' && !world.tuningMode) {
        const k = rad(world.cfg.camera.sensitivityDegPerCount * world.settings.sensitivityMultiplier);
        p.look.yaw = THREE.MathUtils.euclideanModulo(p.look.yaw - delta.x * k, TWO_PI);
        const clampRad = rad(world.cfg.camera.pitchClampDeg);
        p.look.pitch = clamp(p.look.pitch - delta.y * k, -clampRad, clampRad);
      }
      p.transform.yaw = p.look.yaw;
    },
  };
}
