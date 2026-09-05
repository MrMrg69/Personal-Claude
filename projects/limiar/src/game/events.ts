import type { EntityId } from '@/core/entity';
import type { Locomotion } from '@/entities/player';
import type { GameState, InputMode } from './state';

/** Slots de arma (léxico §14: Ferro/Afim/Pesado). O WeaponDef de M1 referencia este tipo. */
export type WeaponSlotId = 'iron' | 'attuned' | 'heavy';

/** Impulso de câmera (recoil/kick): graus e metros para trás. */
export interface CameraKick {
  pitchDeg: number;
  yawDeg: number;
  posBack: number;
}

/**
 * Eventos do jogo (design §3.4). `emit` para reações no mesmo frame; `queue`
 * para consequências que criam/removem entidades (entregues no flush ao fim
 * do passo fixo). Os reservados têm assinatura fixada agora; sistemas em M1+.
 */
export interface GameEvents {
  'game:stateChanged': { from: GameState; to: GameState };
  'game:paused': { reason: 'pointerlock' | 'visibility' | 'user' };
  'game:resumed': Record<string, never>;
  'input:lockChanged': { locked: boolean; mode: InputMode };
  'player:jumped': { fromGround: boolean };
  /** m/s, positivo. */
  'player:landed': { fallSpeed: number };
  'player:locomotionChanged': { from: Locomotion; to: Locomotion };
  'player:respawned': { reason: 'killplane' | 'debug' };
  /** Slot de recoil (F9 em M0; armas em M1). */
  'camera:kick': CameraKick;
  'render:shadowsChanged': { enabled: boolean; auto: boolean };
  /** HMR ou painel; `path` é o caminho da config ('render', 'render.shadows', 'settings.hfovDeg'…). */
  'config:changed': { path: string };
  // Reservados (assinaturas fixadas agora; sistemas em M1+):
  'weapon:fired': { weaponId: string; kick: CameraKick };
  'hit:confirmed': { entity: EntityId; damage: number; crit: boolean; killed: boolean };
  'entity:died': { entity: EntityId; killer: EntityId | null };
  'loot:dropped': { itemInstanceId: string; position: [number, number, number] };
  'item:equipped': { slot: WeaponSlotId; itemInstanceId: string };
  'power:changed': { lume: number };
}
