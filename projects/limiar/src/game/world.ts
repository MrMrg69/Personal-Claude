import type * as THREE from 'three';
import type { CameraRig, HeadOffsets } from '@/core/camera-rig';
import type { DebugStats } from '@/core/debug-stats';
import type { EntityStore } from '@/core/entity';
import type { EventBus } from '@/core/events';
import type { InputState } from '@/core/input';
import type { Random } from '@/core/math/random';
import type { MovementConfig } from '@/core/physics/movement-config';
import type { RenderConfig, Renderer } from '@/core/renderer';
import type { UrlFlags } from '@/core/url-flags';
import type { CameraConfig } from '@/data/camera-config';
import type { FeelConfig } from '@/data/feel-config';
import type { LevelDef } from '@/data/levels/level-def';
import type { Settings } from '@/data/settings-defaults';
import type { AnyEntity, PlayerEntity } from '@/entities';
import type { CollisionWorld } from '@/world/collision-world';
import type { Lighting } from '@/world/lighting';
import type { GameEvents } from './events';
import type { GameState } from './state';

/** Objetos MUTÁVEIS (HMR/painel): sistemas leem os campos no momento do uso. */
export interface GameConfig {
  movement: MovementConfig;
  camera: CameraConfig;
  feel: FeelConfig;
  render: RenderConfig;
}

/**
 * Contexto injetado em todo sistema (design §3.3) — nada global. Além do que
 * o design lista, carrega `renderer` e `lighting` (camera-sync/debug-stats
 * precisam deles), `headOffsets` (camera-feel escreve, camera-sync lê) e as
 * flags de URL/modo de tuning que player-look consulta.
 */
export interface World {
  readonly scene: THREE.Scene;
  readonly rig: CameraRig;
  readonly renderer: Renderer;
  readonly lighting: Lighting;
  readonly input: InputState;
  readonly events: EventBus<GameEvents>;
  readonly collision: CollisionWorld;
  readonly rng: Random;
  readonly entities: EntityStore<AnyEntity>;
  readonly cfg: GameConfig;
  readonly level: LevelDef;
  /** Persistidas (sensibilidade, hfov, sombras, renderScale, debugHud). */
  readonly settings: Settings;
  readonly stats: DebugStats;
  /** Contribuições aditivas da cabeça no frame corrente (camera-feel → camera-sync). */
  readonly headOffsets: HeadOffsets;
  readonly flags: UrlFlags;
  /** DEV ou ?debug=1: atalhos P/T e window.__limiar. */
  readonly debug: boolean;
  player: PlayerEntity;
  state: GameState;
  /** F4 (DEV): mouse livre para o painel, simulação rodando; o look ignora o mouse. */
  tuningMode: boolean;
  time: { sim: number; frame: number; step: number };
}

export type WorldInit = Omit<World, 'state' | 'tuningMode' | 'time'>;

export function createWorld(init: WorldInit): World {
  return { ...init, state: 'booting', tuningMode: false, time: { sim: 0, frame: 0, step: 0 } };
}
