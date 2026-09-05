import * as THREE from 'three';
import { updateShadowFollow } from '@/world/lighting';
import type { System } from './system';

const forward = new THREE.Vector3();

/**
 * Frame #4 (design §4.2, §5.3, §6.2): rig.root = pé interpolado; yaw no
 * corpo, pitch + offsets na cabeça (clamp depois da soma, dentro do rig);
 * câmera de sombra segue o olhar com snap à grade de texels.
 */
export function createCameraSyncSystem(): System {
  return {
    name: 'camera-sync',
    frameUpdate(world, _dt, alpha) {
      const p = world.player;
      const rig = world.rig;
      rig.root.position.lerpVectors(p.transform.prevPosition, p.transform.position, alpha);
      rig.eyeHeight = world.cfg.movement.eyeHeight;
      rig.applyPose(p.look.yaw, p.look.pitch, world.headOffsets);

      // forward = (−sin yaw, 0, −cos yaw): yaw 0 olha para −Z.
      forward.set(-Math.sin(p.look.yaw), 0, -Math.cos(p.look.yaw));
      updateShadowFollow(world.lighting, rig.root.position, forward, world.cfg.render);
    },
  };
}
