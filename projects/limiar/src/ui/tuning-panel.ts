import { SETTINGS_RANGES } from '@/data/settings-defaults';
import type { World } from '@/game/world';

/**
 * Painel de tuning (design §8.2, tecla F4): lil-gui de three/addons por
 * import() dinâmico — só em DEV, fora do bundle de produção. Liga direto nos
 * objetos de world.cfg (mutação in-place; sistemas leem no uso). Mudanças em
 * `render`/`settings` precisam de aplicação explícita → hooks.
 */
export interface TuningPanelHooks {
  /** Algum campo de cfg.render mudou (Renderer.applyConfig + luzes). */
  onRenderChanged(path: string): void;
  /** Algum campo de settings mudou (aplicar + persistir). */
  onSettingsChanged(path: string): void;
  /** Botão "Kick de recoil" (= F9). */
  onKick(): void;
}

export interface TuningPanel {
  readonly visible: boolean;
  show(): void;
  hide(): void;
  dispose(): void;
}

/** Faixas dos sliders (só ergonomia do painel; a config aceita qualquer valor). */
const RANGES = {
  speed: { min: 0, max: 20, step: 0.1 },
  accel: { min: 0, max: 200, step: 1 },
  gravity: { min: -60, max: -5, step: 0.5 },
  small: { min: 0, max: 1, step: 0.01 },
  seconds: { min: 0, max: 1, step: 0.01 },
  deg: { min: 0, max: 90, step: 0.5 },
  fov: { min: 60, max: 120, step: 1 },
  spring: { zeta: { min: 0.1, max: 1.5, step: 0.01 }, omega: { min: 1, max: 40, step: 0.5 } },
  intensity: { min: 0, max: 5, step: 0.05 },
} as const;

/** Módulo lil-gui carregado sob demanda (tipado em @types/three). */
type LilGuiModule = typeof import('three/addons/libs/lil-gui.module.min.js');
type GUI = InstanceType<LilGuiModule['GUI']>;

function copyToClipboard(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {
      // Sem permissão de clipboard: o JSON continua acessível pelo console.
      console.info(text);
    });
  } else {
    console.info(text);
  }
}

function buildGui(GUI: LilGuiModule['GUI'], host: HTMLElement, world: World, hooks: TuningPanelHooks): GUI {
  const gui = new GUI({ container: host, title: 'LIMIAR — tuning', width: 300 });
  const { movement, camera, feel, render } = world.cfg;
  const settings = world.settings;

  const m = gui.addFolder('movement');
  m.add(movement, 'walkSpeed', RANGES.speed.min, RANGES.speed.max, RANGES.speed.step);
  m.add(movement, 'sprintSpeed', RANGES.speed.min, RANGES.speed.max, RANGES.speed.step);
  m.add(movement, 'groundAccel', RANGES.accel.min, RANGES.accel.max, RANGES.accel.step);
  m.add(movement, 'groundDecel', RANGES.accel.min, RANGES.accel.max, RANGES.accel.step);
  m.add(movement, 'airAccel', RANGES.accel.min, RANGES.accel.max, RANGES.accel.step);
  m.add(movement, 'airMaxSpeed', RANGES.speed.min, RANGES.speed.max, RANGES.speed.step);
  m.add(movement, 'gravity', RANGES.gravity.min, RANGES.gravity.max, RANGES.gravity.step);
  m.add(movement, 'jumpHeight', 0.2, 4, 0.05);
  m.add(movement, 'jumpHoldGravityScale', RANGES.small.min, RANGES.small.max, RANGES.small.step);
  m.add(movement, 'jumpHoldDeadTime', RANGES.seconds.min, RANGES.seconds.max, RANGES.seconds.step);
  m.add(movement, 'jumpHoldMaxTime', RANGES.seconds.min, RANGES.seconds.max, RANGES.seconds.step);
  m.add(movement, 'coyoteTime', RANGES.seconds.min, RANGES.seconds.max, RANGES.seconds.step);
  m.add(movement, 'jumpBufferTime', RANGES.seconds.min, RANGES.seconds.max, RANGES.seconds.step);
  m.add(movement, 'slopeLimitDeg', RANGES.deg.min, RANGES.deg.max, RANGES.deg.step);
  m.add(movement, 'stepHeight', RANGES.small.min, RANGES.small.max, RANGES.small.step);
  m.add(movement, 'groundSnapDistance', RANGES.small.min, RANGES.small.max, RANGES.small.step);
  m.add(movement, 'eyeHeight', 0.5, 2.5, 0.01);

  const c = gui.addFolder('camera');
  c.add(camera, 'sprintFovAddDeg', 0, 20, 0.5);
  c.add(camera, 'fovDampLambda', 1, 30, 0.5);
  c.add(camera, 'landFovKickDeg', 0, 10, 0.1);
  c.add(camera, 'landFovKickTime', RANGES.seconds.min, RANGES.seconds.max, RANGES.seconds.step);
  c.add(camera, 'sensitivityDegPerCount', 0.005, 0.1, 0.001);
  c.add(camera, 'pitchClampDeg', 45, 89.9, 0.1);

  const fe = gui.addFolder('feel');
  const lk = fe.addFolder('landKick');
  lk.add(feel.landKick, 'pitchDeg', 0, 10, 0.1);
  lk.add(feel.landKick, 'posY', 0, 0.3, 0.005);
  lk.add(feel.landKick, 'fallSpeedRef', 1, 40, 0.5);
  lk.add(feel.landKick, 'zeta', RANGES.spring.zeta.min, RANGES.spring.zeta.max, RANGES.spring.zeta.step);
  lk.add(feel.landKick, 'omega', RANGES.spring.omega.min, RANGES.spring.omega.max, RANGES.spring.omega.step);
  const rc = fe.addFolder('recoil');
  rc.add(feel.recoil, 'zeta', RANGES.spring.zeta.min, RANGES.spring.zeta.max, RANGES.spring.zeta.step);
  rc.add(feel.recoil, 'omega', RANGES.spring.omega.min, RANGES.spring.omega.max, RANGES.spring.omega.step);
  rc.add(feel.recoil, 'recoveryDegPerSec', 1, 90, 0.5);
  rc.add(feel.recoil.debugKick, 'pitchDeg', 0, 10, 0.1);
  rc.add(feel.recoil.debugKick, 'yawDeg', 0, 5, 0.05);
  rc.add(feel.recoil.debugKick, 'posBack', 0, 0.2, 0.005);
  rc.add({ kick: hooks.onKick }, 'kick').name('Kick de recoil (F9)');
  const hb = fe.addFolder('headBob');
  hb.add(feel.headBob, 'enabled');
  hb.add(feel.headBob, 'ampY', 0, 0.1, 0.001);
  hb.add(feel.headBob, 'ampX', 0, 0.1, 0.001);
  hb.add(feel.headBob, 'rollDeg', 0, 3, 0.05);
  hb.add(feel.headBob, 'hz', 0.5, 4, 0.05);
  hb.add(feel.headBob, 'ampDampLambda', 1, 30, 0.5);

  const r = gui.addFolder('render');
  const renderChanged = (path: string) => () => hooks.onRenderChanged(path);
  r.add(render, 'shadows').onChange(renderChanged('render.shadows'));
  r.add(render, 'shadowMapSize', [512, 1024, 2048, 4096]).onChange(renderChanged('render.shadowMapSize'));
  r.add(render, 'toneMappingExposure', 0.2, 3, 0.05).onChange(renderChanged('render.toneMappingExposure'));
  r.add(render, 'fogDensity', 0, 0.05, 0.0005).onChange(renderChanged('render.fogDensity'));
  r.add(render, 'pixelRatioCap', 0.5, 3, 0.25).onChange(renderChanged('render.pixelRatioCap'));
  r.addColor(render, 'clearColor').onChange(renderChanged('render.clearColor'));
  const li = r.addFolder('lights');
  li.addColor(render.lights, 'hemiSkyColor').onChange(renderChanged('render.lights'));
  li.addColor(render.lights, 'hemiGroundColor').onChange(renderChanged('render.lights'));
  li.add(render.lights, 'hemiIntensity', RANGES.intensity.min, RANGES.intensity.max, RANGES.intensity.step).onChange(renderChanged('render.lights'));
  li.addColor(render.lights, 'sunColor').onChange(renderChanged('render.lights'));
  li.add(render.lights, 'sunIntensity', RANGES.intensity.min, RANGES.intensity.max, RANGES.intensity.step).onChange(renderChanged('render.lights'));
  li.add(render.lights, 'sunElevationDeg', 1, 89, 0.5).onChange(renderChanged('render.lights'));
  li.add(render.lights, 'sunAzimuthDeg', 0, 360, 1).onChange(renderChanged('render.lights'));
  const sh = r.addFolder('shadow');
  sh.add(render.shadow, 'frustumSize', 10, 200, 1).onChange(renderChanged('render.shadow'));
  sh.add(render.shadow, 'bias', -0.01, 0.01, 0.0001).onChange(renderChanged('render.shadow'));
  sh.add(render.shadow, 'normalBias', 0, 0.2, 0.001).onChange(renderChanged('render.shadow'));
  sh.add(render.shadow, 'followDistance', 0, 30, 0.5).onChange(renderChanged('render.shadow'));
  sh.add(render.shadow, 'lightDistance', 10, 200, 1).onChange(renderChanged('render.shadow'));

  const s = gui.addFolder('settings');
  const settingsChanged = (path: string) => () => hooks.onSettingsChanged(path);
  s.add(settings, 'sensitivityMultiplier', SETTINGS_RANGES.sensitivityMultiplier.min, SETTINGS_RANGES.sensitivityMultiplier.max, 0.05).onChange(settingsChanged('settings.sensitivityMultiplier'));
  s.add(settings, 'hfovDeg', SETTINGS_RANGES.hfovDeg.min, SETTINGS_RANGES.hfovDeg.max, 1).onChange(settingsChanged('settings.hfovDeg'));
  s.add(settings, 'shadows').onChange(settingsChanged('settings.shadows'));
  s.add(settings, 'renderScale', SETTINGS_RANGES.renderScale.min, SETTINGS_RANGES.renderScale.max, 0.05).onChange(settingsChanged('settings.renderScale'));
  s.add(settings, 'debugHud').onChange(settingsChanged('settings.debugHud'));

  gui
    .add(
      {
        copy: () => copyToClipboard(JSON.stringify({ movement, camera, feel, render }, null, 2)),
      },
      'copy',
    )
    .name('Copiar JSON (cole em data/*-config.ts)');

  // HMR/atalhos alteram os objetos por fora: o painel acompanha.
  gui.controllersRecursive().forEach((ctrl) => ctrl.listen());
  return gui;
}

/**
 * Cria o painel (escondido). Fora de DEV devolve um painel inerte: o
 * `import()` fica dentro de `if (import.meta.env.DEV)` e o bundle de produção
 * não carrega lil-gui.
 */
export function createTuningPanel(container: HTMLElement, world: World, hooks: TuningPanelHooks): TuningPanel {
  const host = document.createElement('div');
  host.className = 'tuning-panel';
  host.hidden = true;
  container.append(host);
  let gui: GUI | null = null;
  let loading: Promise<void> | null = null;
  let disposed = false;

  const ensureLoaded = (): Promise<void> => {
    if (gui || !import.meta.env.DEV) return Promise.resolve();
    loading ??= import('three/addons/libs/lil-gui.module.min.js').then((mod) => {
      if (disposed) return;
      gui = buildGui(mod.GUI, host, world, hooks);
    });
    return loading;
  };

  return {
    get visible() {
      return !host.hidden;
    },
    show() {
      host.hidden = false;
      void ensureLoaded();
    },
    hide() {
      host.hidden = true;
    },
    dispose() {
      disposed = true;
      gui?.destroy();
      gui = null;
      host.remove();
    },
  };
}
