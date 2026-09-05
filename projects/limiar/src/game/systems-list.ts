import { createCameraFeelSystem } from '@/systems/camera-feel';
import { createCameraSyncSystem } from '@/systems/camera-sync';
import { createCharacterPhysicsSystem } from '@/systems/character-physics';
import { createDebugStatsSystem } from '@/systems/debug-stats-system';
import { createKillPlaneSystem } from '@/systems/kill-plane';
import { createLocomotionStateSystem } from '@/systems/locomotion-state';
import { createPlayerInputSystem } from '@/systems/player-input';
import { createPlayerLookSystem } from '@/systems/player-look';
import type { System } from '@/systems/system';
import { createViewSyncSystem } from '@/systems/view-sync';

/**
 * ÚNICA fonte da ordem de atualização (design §4.2). O loop percorre a lista
 * inteira em cada fase e chama só o método que o sistema define, então a
 * ordem relativa vale tanto para fixedUpdate quanto para frameUpdate:
 *
 *   fixed: player-input → character-physics → kill-plane → [M1+: weapons,
 *          projectiles, ai, damage, abilities, loot, pickup, lifetime] → locomotion-state
 *   frame: player-look → camera-feel → view-sync → camera-sync →
 *          [M1+: viewmodel-anim, hud, audio, vfx] → debug-stats
 */
export function createSystems(): readonly System[] {
  return [
    createPlayerInputSystem(),
    createCharacterPhysicsSystem(),
    createKillPlaneSystem(),
    createLocomotionStateSystem(),
    createPlayerLookSystem(),
    createCameraFeelSystem(),
    createViewSyncSystem(),
    createCameraSyncSystem(),
    createDebugStatsSystem(),
  ];
}
