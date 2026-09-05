import * as THREE from 'three';
import { allocEntityId, type EntityBase } from '@/core/entity';
import { rad } from '@/core/math';
import { createCapsuleBody, createMoveIntent, type CapsuleBody, type MoveIntent } from '@/core/physics/capsule-body';
import { CollisionLayer } from '@/core/physics/layers';
import type { MovementConfig } from '@/core/physics/movement-config';
import type { SpawnPoint } from '@/data/levels/level-def';

export type Locomotion = 'idle' | 'walk' | 'sprint' | 'air';

/** O Vigia (design §3.3). Dados puros; sistemas fazem o trabalho. */
export interface PlayerEntity extends EntityBase {
  readonly kind: 'player';
  body: CapsuleBody;
  /** Escrito por player-input; lido por character-physics. */
  intent: MoveIntent;
  /** Yaw/pitch da cabeça (rad); yaw é copiado para transform.yaw. */
  look: { yaw: number; pitch: number };
  locomotion: Locomotion;
  /** Último ponto no chão; respawn do kill plane. */
  lastSafePosition: THREE.Vector3;
  /** Group vazio em M0 (futuro corpo/sombra do jogador); view-sync o posiciona. */
  view: THREE.Group;
}

export function createPlayer(cfg: MovementConfig, spawn: SpawnPoint): PlayerEntity {
  const position = new THREE.Vector3(spawn.pos[0], spawn.pos[1], spawn.pos[2]);
  const yaw = rad(spawn.yawDeg);
  const view = new THREE.Group();
  view.name = 'player';
  return {
    id: allocEntityId(),
    kind: 'player',
    alive: true,
    transform: { position, prevPosition: position.clone(), yaw },
    body: createCapsuleBody(cfg, CollisionLayer.Player, CollisionLayer.World),
    intent: createMoveIntent(),
    look: { yaw, pitch: 0 },
    locomotion: 'idle',
    lastSafePosition: position.clone(),
    view,
  };
}
