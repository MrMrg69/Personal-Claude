import type { DebugStats } from '@/core/debug-stats';
import type { InputState } from '@/core/input';
import type { GameLoop } from '@/core/loop';
import type { Renderer } from '@/core/renderer';
import type { GameState } from './state';
import type { World } from './world';

/**
 * window.__limiar (design §8.1): exposto em DEV ou com ?debug=1 para o e2e e
 * para o console. `input.inject` é o modo sintético do InputState (§4.3) —
 * o e2e anda e olha por aqui porque pointer lock não existe em headless.
 */
export interface LimiarDebugApi {
  readonly world: World;
  readonly loop: GameLoop;
  readonly renderer: Renderer;
  readonly stats: DebugStats;
  readonly input: { inject: InputState['inject'] };
  respawn(): void;
  readonly state: GameState;
  /** true quando o jogo terminou de montar (o e2e espera por isto). */
  ready: boolean;
}

export function installDebugApi(api: LimiarDebugApi): void {
  window.__limiar = api;
}

export function uninstallDebugApi(api: LimiarDebugApi): void {
  if (window.__limiar === api) delete window.__limiar;
}
