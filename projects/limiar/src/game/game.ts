import * as THREE from 'three';
import { CameraRig, createHeadOffsets } from '@/core/camera-rig';
import { DebugStats } from '@/core/debug-stats';
import { EntityStore } from '@/core/entity';
import { EventBus } from '@/core/events';
import { InputState } from '@/core/input';
import { Layer } from '@/core/layers';
import { GameLoop } from '@/core/loop';
import { Random } from '@/core/math/random';
import { DEFAULT_POINTER_LOCK_OPTIONS, PointerLockController, type PointerLockMode } from '@/core/pointer-lock';
import { createRenderer, type RenderConfig, type Renderer } from '@/core/renderer';
import { SaveStore } from '@/core/storage';
import { readUrlFlags } from '@/core/url-flags';
import { DEFS, validateDefs } from '@/data';
import { CAMERA } from '@/data/camera-config';
import { FEEL } from '@/data/feel-config';
import { INPUT_BINDINGS } from '@/data/input-bindings';
import { TEST_GROUND, TEST_GROUND_TOWER_TOP } from '@/data/levels/test-ground';
import { MOVEMENT } from '@/data/movement-config';
import { PALETTE } from '@/data/palette';
import { RENDER, RENDER_SCALE_ALT } from '@/data/render-config';
import {
  DEFAULT_SETTINGS,
  isSettings,
  SETTINGS_MIGRATIONS,
  SETTINGS_SAVE_KEY,
  SETTINGS_SAVE_VERSION,
  type Settings,
} from '@/data/settings-defaults';
import { createPlayer, createStaticWorld, type AnyEntity } from '@/entities';
import { placePlayer, respawnPlayer } from '@/systems/kill-plane';
import type { System } from '@/systems/system';
import { DebugHud } from '@/ui/debug-hud';
import { Overlay } from '@/ui/overlay';
import { createTuningPanel, type TuningPanel } from '@/ui/tuning-panel';
import { CollisionWorld } from '@/world/collision-world';
import { applyLightingConfig, createLighting } from '@/world/lighting';
import { installDebugApi, uninstallDebugApi, type LimiarDebugApi } from './debug-api';
import type { GameEvents } from './events';
import type { GameState } from './state';
import { createSystems } from './systems-list';
import { createWorld, type World } from './world';

export interface GameElements {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  ui: HTMLElement;
}

/** Subdivisões do wireframe da cápsula de debug (F6). */
const CAPSULE_HELPER_SEGMENTS = { cap: 4, radial: 8 } as const;

/** Copia uma RenderConfig sobre outra sem trocar as referências aninhadas. */
function assignRenderConfig(dst: RenderConfig, src: RenderConfig): void {
  const { lights, shadow, ...scalars } = src;
  Object.assign(dst, scalars);
  Object.assign(dst.lights, lights);
  Object.assign(dst.shadow, shadow);
}

/**
 * Monta e coordena tudo (design §4.4, §8): renderer, cena, luzes, nível,
 * entidades, colisão, sistemas e loop; estados/pausa/pointer lock com
 * overlay; atalhos de debug; HMR de configuração; API de debug.
 */
export class Game {
  readonly world: World;
  readonly loop: GameLoop;
  readonly renderer: Renderer;
  readonly stats: DebugStats;

  private readonly systems: readonly System[];
  private readonly settingsStore: SaveStore<Settings>;
  private readonly pointerLock: PointerLockController;
  private readonly overlay: Overlay;
  private readonly hud: DebugHud;
  private readonly panel: TuningPanel;
  private readonly canvas: HTMLCanvasElement;
  private readonly debugApi: LimiarDebugApi | null;
  private readonly unsubscribe: (() => void)[] = [];
  private octreeHelper: THREE.Object3D | null = null;
  private capsuleHelper: THREE.Mesh | null = null;
  private helpersVisible = false;
  private shadowsAutoOff = false;
  private disposed = false;

  constructor(els: GameElements) {
    this.canvas = els.canvas;
    const flags = readUrlFlags();
    const debug = import.meta.env.DEV || flags.debug;

    // Configurações persistidas + overrides de URL (?shadows ?scale ?hud).
    this.settingsStore = new SaveStore<Settings>({
      key: SETTINGS_SAVE_KEY,
      version: SETTINGS_SAVE_VERSION,
      migrations: SETTINGS_MIGRATIONS,
      validate: isSettings,
    });
    const settings: Settings = { ...DEFAULT_SETTINGS, ...(this.settingsStore.load() ?? {}) };
    if (flags.shadows !== null) settings.shadows = flags.shadows;
    if (flags.scale !== null) settings.renderScale = flags.scale;
    if (flags.hud !== null) settings.debugHud = flags.hud;
    // O que o usuário escolheu vale sobre o padrão de render-config.
    RENDER.shadows = settings.shadows;
    RENDER.renderScale = settings.renderScale;

    if (import.meta.env.DEV) validateDefs(DEFS);

    // Renderer (lança sem WebGL2 — main.ts mostra o overlay), cena, rig.
    this.renderer = createRenderer(els.canvas, els.container, RENDER);
    const scene = new THREE.Scene();
    const rig = new CameraRig({
      eyeHeight: MOVEMENT.eyeHeight,
      hfovDeg: settings.hfovDeg,
      aspect: this.renderer.aspect,
      near: CAMERA.near,
      far: CAMERA.far,
      viewmodelFovDeg: CAMERA.viewmodelFovDeg,
      viewmodelNear: CAMERA.viewmodelNear,
      viewmodelFar: CAMERA.viewmodelFar,
      pitchClampDeg: CAMERA.pitchClampDeg,
    });
    scene.add(rig.root);
    // O resize chega no início do renderFrame: reaplica o hFOV corrente com o aspect novo.
    this.renderer.onResize = (_w, _h, aspect) => rig.setHfov(rig.hfovDeg, aspect);

    // Nível → cena + colisão; jogador; luzes.
    const collision = new CollisionWorld();
    const staticWorld = createStaticWorld(TEST_GROUND);
    scene.add(staticWorld.root, staticWorld.built.helpers);
    collision.rebuildStatic(staticWorld.built.collisionRoot);
    const player = createPlayer(MOVEMENT, staticWorld.built.playerSpawn);
    scene.add(player.view);
    const lighting = createLighting(scene, RENDER);

    const entities = new EntityStore<AnyEntity>();
    entities.add(staticWorld);
    entities.add(player);

    this.stats = new DebugStats({ marks: import.meta.env.DEV });
    this.world = createWorld({
      scene,
      rig,
      renderer: this.renderer,
      lighting,
      input: new InputState(INPUT_BINDINGS),
      events: new EventBus<GameEvents>(),
      collision,
      rng: new Random(flags.seed ?? Date.now()),
      entities,
      cfg: { movement: MOVEMENT, camera: CAMERA, feel: FEEL, render: RENDER },
      level: TEST_GROUND,
      settings,
      stats: this.stats,
      headOffsets: createHeadOffsets(),
      flags,
      debug,
      player,
    });

    this.systems = createSystems();
    for (const s of this.systems) s.init?.(this.world);

    // UI.
    this.overlay = new Overlay(els.ui, this.handleOverlayActivate);
    this.hud = new DebugHud(els.ui);
    this.hud.setVisible(settings.debugHud);
    this.panel = createTuningPanel(els.ui, this.world, {
      onRenderChanged: (path) => this.applyRenderConfig(path),
      onSettingsChanged: (path) => this.applySettings(path),
      onKick: () => this.debugKick(),
    });

    // Input e pointer lock.
    this.world.input.attach(els.canvas);
    this.pointerLock = new PointerLockController(
      els.canvas,
      { onChange: this.handleLockChange, onError: this.handleLockError },
      { ...DEFAULT_POINTER_LOCK_OPTIONS, forceUnlocked: flags.nolock },
    );
    els.canvas.addEventListener('mousedown', this.handleCanvasMouseDown);
    els.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.unsubscribe.push(
      this.world.events.on('config:changed', ({ path }) => {
        if (path.startsWith('render')) this.applyRenderConfig(path);
      }),
      this.world.events.on('render:shadowsChanged', ({ enabled, auto }) => {
        this.shadowsAutoOff = !enabled && auto;
      }),
    );
    this.installHmr();

    // Loop: começa pausado em 'ready' (o render continua atrás do overlay).
    this.loop = new GameLoop({
      fixedUpdate: this.fixedUpdate,
      frameUpdate: this.frameUpdate,
      render: this.render,
    });
    this.loop.pause();
    this.renderer.gl.setAnimationLoop((t) => this.loop.tick(t));
    this.setState('ready');
    this.overlay.show({ kind: 'ready', mode: this.pointerLock.mode });

    const world = this.world;
    this.debugApi = debug
      ? {
          world,
          loop: this.loop,
          renderer: this.renderer,
          stats: this.stats,
          input: { inject: (partial, delta) => world.input.inject(partial, delta) },
          respawn: () => respawnPlayer(world, 'debug'),
          get state() {
            return world.state;
          },
          ready: true,
        }
      : null;
    if (this.debugApi) installDebugApi(this.debugApi);
  }

  get state(): GameState {
    return this.world.state;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.gl.setAnimationLoop(null);
    for (const u of this.unsubscribe) u();
    for (const s of this.systems) s.dispose?.(this.world);
    this.world.events.clear();
    this.world.input.detach();
    this.pointerLock.dispose();
    this.canvas.removeEventListener('mousedown', this.handleCanvasMouseDown);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.panel.dispose();
    this.hud.dispose();
    this.overlay.dispose();
    if (this.debugApi) uninstallDebugApi(this.debugApi);
    this.renderer.dispose();
  }

  // ---- Loop ----

  private readonly fixedUpdate = (dt: number): void => {
    const w = this.world;
    this.stats.mark('sim-start');
    w.time.sim += dt;
    w.time.step++;
    this.handleDebugKeys();
    for (const s of this.systems) s.fixedUpdate?.(w, dt);
    w.events.flush();
    w.entities.flushRemovals();
    w.input.endFixedStep();
    this.stats.mark('sim-end');
    this.stats.measure('sim', 'sim-start', 'sim-end');
  };

  private readonly frameUpdate = (dt: number, alpha: number): void => {
    const w = this.world;
    this.stats.mark('frame-start');
    w.time.frame += dt;
    for (const s of this.systems) s.frameUpdate?.(w, dt, alpha);
    this.hud.update({
      world: w,
      loop: this.loop.stats,
      loopPaused: this.loop.paused,
      lockLabel: this.lockLabel(),
      shadowsAutoOff: this.shadowsAutoOff,
    });
    this.stats.mark('frame-end');
    this.stats.measure('frame', 'frame-start', 'frame-end');
  };

  private readonly render = (): void => {
    this.stats.mark('render-start');
    this.renderer.renderFrame(this.world.scene, this.world.rig);
    this.stats.mark('render-end');
    this.stats.measure('render', 'render-start', 'render-end');
  };

  // ---- Estados (design §4.4) ----

  private setState(to: GameState): void {
    const from = this.world.state;
    if (from === to) return;
    this.world.state = to;
    this.world.events.emit('game:stateChanged', { from, to });
  }

  private run(): void {
    const s = this.world.state;
    if (s !== 'ready' && s !== 'paused') return;
    this.world.input.reset();
    this.overlay.hide();
    this.loop.resume();
    this.setState('running');
    this.world.events.emit('game:resumed', {});
  }

  private pause(reason: GameEvents['game:paused']['reason']): void {
    if (this.world.state !== 'running') return;
    this.loop.pause();
    this.world.input.reset();
    this.exitTuningMode(false);
    this.setState('paused');
    this.overlay.show({ kind: 'paused', mode: this.pointerLock.mode });
    this.world.events.emit('game:paused', { reason });
  }

  private fail(kind: 'contextlost'): void {
    this.loop.pause();
    this.world.input.reset();
    this.setState('error');
    this.overlay.show({ kind, mode: this.pointerLock.mode });
  }

  /** Clique no overlay: pede o lock; 'locked'/'unlocked' → roda; 'cooldown' → contador. */
  private readonly handleOverlayActivate = (): void => {
    const s = this.world.state;
    if (s !== 'ready' && s !== 'paused') return;
    void this.pointerLock.request().then((result) => {
      if (this.disposed) return;
      if (result === 'cooldown') {
        this.overlay.show({ kind: 'cooldown', mode: this.pointerLock.mode, cooldownMs: this.pointerLock.cooldownRemainingMs() });
        return;
      }
      this.run();
    });
  };

  private readonly handleLockChange = (locked: boolean, mode: PointerLockMode): void => {
    this.world.events.emit('input:lockChanged', { locked, mode });
    if (locked) {
      // Relock vindo de um clique no canvas (saída do modo de tuning) ou do overlay.
      this.run();
      return;
    }
    // Perda do lock em modo locked = Esc do usuário → pausa (exceto no modo de tuning).
    if (mode === 'locked' && !this.world.tuningMode) this.pause('pointerlock');
  };

  private readonly handleLockError = (cooldownMs: number): void => {
    if (this.world.state === 'running') return;
    this.overlay.show({ kind: 'cooldown', mode: this.pointerLock.mode, cooldownMs });
  };

  private readonly handleVisibility = (): void => {
    if (document.visibilityState !== 'hidden') return;
    this.pointerLock.exit();
    this.pause('visibility');
  };

  private readonly handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.fail('contextlost');
  };

  /** Clique no canvas durante o modo de tuning: volta ao jogo (relock). */
  private readonly handleCanvasMouseDown = (): void => {
    if (this.world.tuningMode) this.exitTuningMode(true);
  };

  // ---- Modo de tuning (F4, só DEV) ----

  private enterTuningMode(): void {
    if (!import.meta.env.DEV || this.world.tuningMode) return;
    // tuningMode antes de exit(): o pointerlockchange resultante não pode pausar.
    this.world.tuningMode = true;
    this.pointerLock.exit();
    this.panel.show();
  }

  private exitTuningMode(relock: boolean): void {
    if (!this.world.tuningMode) return;
    this.world.tuningMode = false;
    this.panel.hide();
    if (relock && this.world.state === 'running') {
      void this.pointerLock.request().then((result) => {
        if (!this.disposed && result === 'cooldown') this.pause('user');
      });
    }
  }

  // ---- Atalhos de debug (design §8.3), lidos por passo fixo (bordas) ----

  private handleDebugKeys(): void {
    const { input, settings, debug } = this.world;
    if (input.justPressed('debugHud')) {
      settings.debugHud = !settings.debugHud;
      this.hud.setVisible(settings.debugHud);
      this.saveSettings();
    }
    if (input.justPressed('debugPanel')) {
      if (this.world.tuningMode) this.exitTuningMode(true);
      else this.enterTuningMode();
    }
    if (input.justPressed('debugHelpers')) this.setHelpersVisible(!this.helpersVisible);
    if (input.justPressed('debugShadows')) {
      settings.shadows = !this.world.cfg.render.shadows;
      this.applySettings('settings.shadows');
    }
    if (input.justPressed('debugRenderScale')) {
      settings.renderScale = settings.renderScale === 1 ? RENDER_SCALE_ALT : 1;
      this.applySettings('settings.renderScale');
    }
    if (input.justPressed('debugKick')) this.debugKick();
    if (debug && input.justPressed('debugRespawn')) respawnPlayer(this.world, 'debug');
    if (debug && input.justPressed('debugTeleport')) {
      placePlayer(this.world, TEST_GROUND_TOWER_TOP[0], TEST_GROUND_TOWER_TOP[1], TEST_GROUND_TOWER_TOP[2]);
    }
    // Escape só chega aqui no modo sem lock (com lock, o navegador sai do lock → pausa).
    if (input.justPressed('pause') && this.pointerLock.mode === 'unlocked') this.pause('user');
  }

  private debugKick(): void {
    const k = this.world.cfg.feel.recoil.debugKick;
    const side = this.world.rng.next() < 0.5 ? -1 : 1;
    this.world.events.emit('camera:kick', { pitchDeg: k.pitchDeg, yawDeg: k.yawDeg * side, posBack: k.posBack });
  }

  private setHelpersVisible(visible: boolean): void {
    this.helpersVisible = visible;
    this.world.rig.setDebugLayerVisible(visible);
    if (!visible) return;
    // Helpers pesados são criados na primeira vez (alocação fora do hot path).
    if (!this.octreeHelper) {
      this.octreeHelper = this.world.collision.debugHelper();
      this.world.scene.add(this.octreeHelper);
    }
    if (!this.capsuleHelper) {
      const body = this.world.player.body;
      const geometry = new THREE.CapsuleGeometry(
        body.radius,
        body.height - 2 * body.radius,
        CAPSULE_HELPER_SEGMENTS.cap,
        CAPSULE_HELPER_SEGMENTS.radial,
      );
      const material = new THREE.MeshBasicMaterial({ color: PALETTE.wardenCyan, wireframe: true });
      this.capsuleHelper = new THREE.Mesh(geometry, material);
      this.capsuleHelper.name = 'player-capsule-debug';
      this.capsuleHelper.position.y = body.height / 2;
      this.capsuleHelper.layers.set(Layer.DEBUG);
      this.world.player.view.add(this.capsuleHelper);
    }
  }

  // ---- Configuração: render, settings, HMR ----

  /** Mudança em cfg.render (painel, HMR, auto-desligar sombras): aplica no renderer e nas luzes. */
  private applyRenderConfig(path: string): void {
    const w = this.world;
    this.renderer.applyConfig(w.cfg.render, w.scene);
    applyLightingConfig(w.lighting, w.scene, w.cfg.render);
    if (path === 'render.shadows' && w.cfg.render.shadows) this.shadowsAutoOff = false;
  }

  /** Mudança em settings (atalhos/painel): aplica o efeito e persiste. */
  private applySettings(path: string): void {
    const w = this.world;
    const s = w.settings;
    switch (path) {
      case 'settings.shadows':
        w.cfg.render.shadows = s.shadows;
        this.applyRenderConfig('render.shadows');
        w.events.emit('render:shadowsChanged', { enabled: s.shadows, auto: false });
        break;
      case 'settings.renderScale':
        w.cfg.render.renderScale = s.renderScale;
        this.renderer.setRenderScale(s.renderScale);
        break;
      case 'settings.debugHud':
        this.hud.setVisible(s.debugHud);
        break;
      default:
        // sensitivityMultiplier/hfovDeg: os sistemas leem settings no uso.
        break;
    }
    w.events.emit('config:changed', { path });
    this.saveSettings();
  }

  private saveSettings(): void {
    this.settingsStore.save(this.world.settings);
  }

  /**
   * HMR (design §3.5): movement/camera/feel se auto-aceitam em data/ (Object.assign
   * in-place; sistemas leem no uso). render-config não se auto-aceita porque
   * precisa de aplicação explícita — o accept de dependência fica aqui.
   */
  private installHmr(): void {
    if (!import.meta.hot) return;
    import.meta.hot.accept('../data/render-config', (mod) => {
      const next: RenderConfig | undefined = mod?.RENDER;
      if (!next || this.disposed) return;
      // Sombras/escala são escolha do usuário (settings), não do arquivo.
      assignRenderConfig(this.world.cfg.render, next);
      this.world.cfg.render.shadows = this.world.settings.shadows;
      this.world.cfg.render.renderScale = this.world.settings.renderScale;
      this.world.events.emit('config:changed', { path: 'render' });
    });
  }

  private lockLabel(): string {
    if (this.pointerLock.mode === 'unlocked') return 'NOLOCK';
    if (this.world.tuningMode) return 'TUNING';
    return this.pointerLock.locked ? 'LOCKED' : 'UNLOCKED';
  }
}
