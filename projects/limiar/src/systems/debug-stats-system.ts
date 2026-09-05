import { SHADOW_AUTO_OFF } from '@/data/render-config';
import type { System } from './system';

/**
 * Frame #5 (design §4.2, §6.4): alimenta DebugStats (frame time; renderer.info
 * do frame anterior — o Renderer zera o contador no início de cada
 * renderFrame) e desliga as sombras UMA vez se a média de 3 s passar do
 * limiar. Heurística por medição: WebGLCapabilities não detecta hardware fraco.
 * O desligamento automático não toca em settings.shadows (escolha do usuário).
 * A carência (graceSec) conta desde que as sombras foram LIGADAS (início da
 * sessão, F7, painel ou HMR — todos passam por cfg.render.shadows): a média de
 * 3 s medida sem sombras não pode condenar as sombras recém-ligadas.
 */
export function createDebugStatsSystem(): System {
  let autoDisabled = false;
  let prevShadows = false;
  let shadowsOnSince = 0;

  return {
    name: 'debug-stats',
    frameUpdate(world, dt) {
      const stats = world.stats;
      stats.recordFrame(dt);
      stats.readRenderer(world.renderer.gl.info);

      const on = world.cfg.render.shadows;
      if (on && !prevShadows) shadowsOnSince = world.time.frame;
      prevShadows = on;

      if (autoDisabled || !on || world.state !== 'running') return;
      if (world.time.frame - shadowsOnSince < SHADOW_AUTO_OFF.graceSec) return;
      if (stats.frameAvg3sMs <= SHADOW_AUTO_OFF.frameAvgMs) return;
      autoDisabled = true;
      world.cfg.render.shadows = false;
      // game.ts aplica a config no renderer/luzes ao ouvir config:changed.
      world.events.emit('config:changed', { path: 'render.shadows' });
      world.events.emit('render:shadowsChanged', { enabled: false, auto: true });
    },
  };
}
