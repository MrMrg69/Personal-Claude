import type { LoopStats } from '@/core/loop';
import { deg } from '@/core/math';
import { countDefs, DEFS } from '@/data';
import type { World } from '@/game/world';

/** Atualizações por segundo do HUD (design §8.1: 4×/s via textContent). */
const HUD_HZ = 4;

/** Só o que o HUD precisa além do World (o resto ele lê do próprio World). */
export interface HudView {
  world: World;
  loop: LoopStats;
  loopPaused: boolean;
  lockLabel: string;
  /** Aviso de sombras desligadas automaticamente (§6.4). */
  shadowsAutoOff: boolean;
}

function f(v: number, digits = 2): string {
  return v.toFixed(digits).padStart(digits + 3);
}

function k(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

/**
 * HUD de debug (design §8.1): <pre> no canto superior esquerdo, 12 px mono,
 * pointer-events: none. Formata strings 4×/s (alocação aceita nessa taxa).
 */
export class DebugHud {
  private readonly el: HTMLPreElement;
  private nextUpdateAt = 0;
  private readonly defsLine: string;

  constructor(container: HTMLElement) {
    this.el = document.createElement('pre');
    this.el.className = 'debug-hud';
    this.el.hidden = true;
    container.append(this.el);
    const c = countDefs(DEFS);
    this.defsLine = `defs: ${c.elements} elementos, ${c.factions} facções, ${c.levels} nível${c.levels === 1 ? '' : 'is'}`;
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
    if (visible) this.nextUpdateAt = 0;
  }

  /** Chamar 1×/frame; atualiza o DOM só a HUD_HZ. */
  update(view: HudView): void {
    if (this.el.hidden) return;
    const now = view.world.time.frame;
    if (now < this.nextUpdateAt) return;
    this.nextUpdateAt = now + 1 / HUD_HZ;
    this.el.textContent = this.format(view);
  }

  dispose(): void {
    this.el.remove();
  }

  private format({ world, loop, loopPaused, lockLabel, shadowsAutoOff }: HudView): string {
    const s = world.stats;
    const r = world.renderer;
    const p = world.player;
    const b = p.body;
    const v = b.velocity;
    const pos = p.transform.position;
    const cfg = world.cfg;
    const tag = import.meta.env.DEV ? 'dev' : 'prod';
    const shadows = shadowsAutoOff ? 'AUTO-OFF (F7 religa)' : cfg.render.shadows ? 'ON' : 'OFF';
    const coyote = Math.max(0, cfg.movement.coyoteTime - b.timeSinceGrounded);
    const air = b.grounded ? 0 : b.timeSinceGrounded;
    const w = Math.round(r.cssWidth * r.renderScale * r.gl.getPixelRatio());
    const h = Math.round(r.cssHeight * r.renderScale * r.gl.getPixelRatio());

    return [
      `LIMIAR ${tag} | FPS ${s.fps.toFixed(0).padStart(3)}  frame ${s.frameAvgMs.toFixed(1)} ms (avg) / ${s.frameMaxMs.toFixed(1)} (max 1s) / ${s.frameAvg3sMs.toFixed(1)} (avg 3s) | sim ${loop.stepsLastFrame} passo/frame  drop ${loop.droppedSteps}`,
      `draw ${s.drawCalls}  tris ${k(s.triangles)}  geom ${s.geometries}  tex ${s.textures}  prog ${s.programs} | dpr ${r.gl.getPixelRatio().toFixed(2)}  scale ${r.renderScale.toFixed(2)}  ${w}x${h} | sombras ${shadows}`,
      `pos ${f(pos.x)} ${f(pos.y)} ${f(pos.z)} | vel ${f(v.x)} ${f(v.y)} ${f(v.z)} | h ${Math.hypot(v.x, v.z).toFixed(1)} m/s | ${p.locomotion.toUpperCase().padEnd(6)} ${b.grounded ? 'grounded' : 'air     '} (n.y ${b.groundNormal.y.toFixed(2)})  coyote ${coyote.toFixed(2)}  ar ${air.toFixed(2)} s`,
      `look yaw ${deg(p.look.yaw).toFixed(1)}°  pitch ${deg(p.look.pitch).toFixed(1)}° | hfov ${world.settings.hfovDeg}→${world.rig.hfovDeg.toFixed(0)} (vfov ${world.rig.worldCamera.fov.toFixed(1)}) | sens ${world.settings.sensitivityMultiplier}`,
      `lock ${lockLabel}  loop ${loopPaused ? 'PAUSED' : 'RUNNING'}  estado ${world.state} | ents ${world.entities.size} | ${this.defsLine} | seed ${world.rng.seed}`,
      `F3 hud  F4 painel  F6 helpers  F7 sombras  F8 escala  F9 kick  ${world.debug ? '(P respawn  T torre)' : ''}`.trimEnd(),
    ].join('\n');
  }
}
