import type { InputBindings } from '@/core/input';

/**
 * KeyboardEvent.code → ação (design §4.3). Por `code` (posição física) para
 * funcionar em ABNT2/AZERTY. 'Mouse0/2' são botões; 'Wheel' é a roda.
 * F5 evitado de propósito (recarrega a página); P/T só valem com ?debug (game/).
 */
export const INPUT_BINDINGS: InputBindings = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ControlLeft: 'crouch',
  KeyC: 'crouch',
  Mouse0: 'fire',
  Mouse2: 'aim',
  KeyR: 'reload',
  KeyF: 'melee',
  KeyQ: 'grenade',
  KeyE: 'classAbility',
  KeyX: 'super',
  KeyG: 'interact',
  Wheel: 'swapWeapon',
  F3: 'debugHud',
  F4: 'debugPanel',
  F6: 'debugHelpers',
  F7: 'debugShadows',
  F8: 'debugRenderScale',
  F9: 'debugKick',
  KeyP: 'debugRespawn',
  KeyT: 'debugTeleport',
  Escape: 'pause',
};
