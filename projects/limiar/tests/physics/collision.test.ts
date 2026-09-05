import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EntityId, Transform } from '@/core/entity';
import { rad } from '@/core/math';
import { createCapsuleBody, createMoveIntent, integrateCapsuleBody, type CapsuleBody, type MoveIntent } from '@/core/physics/capsule-body';
import type { RayHit } from '@/core/physics/collision-query';
import { resolveCapsuleCollision, type CollisionResolveResult } from '@/core/physics/collision-resolve';
import { CollisionLayer } from '@/core/physics/layers';
import { FIXED_DT } from '@/core/time';
import type { LevelDef } from '@/data/levels/level-def';
import { MOVEMENT } from '@/data/movement-config';
import { TEST_GROUND } from '@/data/levels/test-ground';
import { CollisionWorld } from '@/world/collision-world';
import { buildLevel } from '@/world/level-builder';

/**
 * Nível sintético (design §9): chão, rampas 20,6°/40°/53° subindo para −X,
 * degraus 0,25/0,35/0,50, corredor de 1,2 m e uma caixa só visual.
 */
const LEVEL: LevelDef = {
  id: 'synthetic',
  name: 'Sintético',
  props: [
    { kind: 'box', pos: [0, -1, 0], size: [80, 1, 80], color: 0x808080, name: 'floor' },
    { kind: 'ramp', pos: [-10, 0, 0], run: 8, rise: 3, width: 4, dirYawDeg: 90, color: 0x808080, name: 'ramp-20' },
    { kind: 'box', pos: [-16, 0, 0], size: [4, 3, 4], color: 0x808080, name: 'ramp-20-top' },
    { kind: 'ramp', pos: [-10, 0, 10], run: 4, rise: 3.36, width: 3, dirYawDeg: 90, color: 0x808080, name: 'ramp-40' },
    { kind: 'ramp', pos: [-10, 0, -10], run: 3, rise: 4, width: 3, dirYawDeg: 90, color: 0x808080, name: 'ramp-53' },
    { kind: 'box', pos: [10, 0, -1], size: [3, 0.25, 4], color: 0x808080, name: 'step-25' },
    { kind: 'box', pos: [10, 0, 6], size: [3, 0.35, 4], color: 0x808080, name: 'step-35' },
    { kind: 'box', pos: [10, 0, -7], size: [3, 0.5, 4], color: 0x808080, name: 'step-50' },
    { kind: 'box', pos: [-0.75, 0, -20], size: [0.3, 3, 10], color: 0x808080, name: 'corridor-w' },
    { kind: 'box', pos: [0.75, 0, -20], size: [0.3, 3, 10], color: 0x808080, name: 'corridor-e' },
    { kind: 'box', pos: [0, 0, 20], size: [2, 2, 2], color: 0x808080, collider: false, name: 'decor' },
    { kind: 'cylinder', pos: [20, 0, 20], radius: 0.5, height: 2, color: 0x808080, bands: [0xff0000, 0x00ff00], name: 'cyl' },
  ],
  spawnPoints: [{ pos: [0, 0, 5], yawDeg: 0, tag: 'player' }],
  coverPoints: [],
  killPlaneY: -20,
  bounds: { halfSize: 40 },
};

const COS_SLOPE = Math.cos(rad(MOVEMENT.slopeLimitDeg));
const STEPS_PER_SECOND = Math.round(1 / FIXED_DT);

interface Sim {
  t: Transform;
  body: CapsuleBody;
  intent: MoveIntent;
  jumped: { jumped: boolean };
  resolved: CollisionResolveResult;
  landings: number;
  maxY: number;
  minSpeedAfterAccel: number;
  airSteps: number;
  /** Mundo de colisão desta simulação (cada describe usa o seu; nada de estado compartilhado por ordem). */
  world: CollisionWorld;
}

let world: CollisionWorld;

function makeSim(x: number, y: number, z: number, yawDeg: number, w: CollisionWorld = world): Sim {
  const body = createCapsuleBody(MOVEMENT, CollisionLayer.Player, CollisionLayer.World);
  const intent = createMoveIntent();
  intent.yaw = rad(yawDeg);
  return {
    t: { position: new THREE.Vector3(x, y, z), prevPosition: new THREE.Vector3(x, y, z), yaw: intent.yaw },
    body,
    intent,
    jumped: { jumped: false },
    resolved: { landed: false, fallSpeed: 0 },
    landings: 0,
    maxY: y,
    minSpeedAfterAccel: Infinity,
    airSteps: 0,
    world: w,
  };
}

/** Passo fixo completo: integra + resolve; acumula métricas. */
function step(s: Sim, n: number): void {
  for (let i = 0; i < n; i++) {
    integrateCapsuleBody(s.t, s.body, s.intent, MOVEMENT, FIXED_DT, s.jumped);
    s.intent.jumpPressed = false;
    resolveCapsuleCollision(s.t, s.body, s.world, MOVEMENT, s.resolved);
    if (s.resolved.landed) s.landings++;
    s.maxY = Math.max(s.maxY, s.t.position.y);
    if (!s.body.grounded) s.airSteps++;
    // Depois de 0,2 s (aceleração 0 → 6 m/s leva 0,1 s) a velocidade não deve cair.
    if (i >= STEPS_PER_SECOND / 5) {
      s.minSpeedAfterAccel = Math.min(s.minSpeedAfterAccel, Math.hypot(s.body.velocity.x, s.body.velocity.z));
    }
  }
}

/** Deixa o corpo assentar no chão antes de andar (spawn cai e gruda). */
function settle(s: Sim): void {
  step(s, 10);
  s.landings = 0;
  s.airSteps = 0;
  s.minSpeedAfterAccel = Infinity;
}

function makeRayHit(): RayHit {
  return { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, layer: CollisionLayer.None, entity: null };
}

beforeAll(() => {
  const built = buildLevel(LEVEL);
  world = new CollisionWorld();
  world.rebuildStatic(built.collisionRoot);
});

describe('level-builder', () => {
  it('mescla por quadrante em ≤ 4 meshes com colisão + 1 decor fora da colisão', () => {
    const built = buildLevel(LEVEL);
    expect(built.collisionRoot.children.length).toBeLessThanOrEqual(4);
    // staticRoot = [collisionRoot, decor].
    expect(built.staticRoot.children.length).toBe(2);
    const decor = built.staticRoot.getObjectByName('decor');
    expect(decor).toBeDefined();
    expect(decor?.parent).toBe(built.staticRoot);
    expect(built.stats.meshes).toBe(built.collisionRoot.children.length + 1);
    expect(built.playerSpawn.pos).toEqual([0, 0, 5]);
    // Rampa = 8 triângulos; caixa = 12; cilindro com 2 faixas.
    expect(built.stats.triangles).toBeGreaterThan(10 * 12 + 3 * 8);
    expect(world.bounds.isEmpty()).toBe(false);
  });

  it('geometria mesclada tem cor por vértice e não tem uv', () => {
    const built = buildLevel(LEVEL);
    for (const child of built.collisionRoot.children) {
      const mesh = child as THREE.Mesh;
      expect(mesh.geometry.getAttribute('color')).toBeDefined();
      expect(mesh.geometry.getAttribute('uv')).toBeUndefined();
      expect(mesh.geometry.index).toBeNull();
    }
  });
});

describe('resolveCapsuleCollision × Octree real', () => {
  it('spawn cai, pousa uma vez e fica grounded em y ≈ 0', () => {
    const s = makeSim(0, 0.5, 5, 0);
    step(s, 30);
    expect(s.landings).toBe(1);
    expect(s.body.grounded).toBe(true);
    expect(s.t.position.y).toBeCloseTo(0, 2);
    expect(s.body.groundNormal.y).toBeCloseTo(1, 3);
  });

  it('rampa 40°: caminhável (grounded com normal.y ≈ cos 40°)', () => {
    const s = makeSim(-6, 0, 10, 90);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, 40);
    expect(s.t.position.x).toBeLessThan(-8.2);
    expect(s.t.position.x).toBeGreaterThan(-11.8);
    expect(s.t.position.y).toBeGreaterThan(0.5);
    expect(s.body.grounded).toBe(true);
    expect(s.body.groundNormal.y).toBeGreaterThanOrEqual(COS_SLOPE);
    expect(s.body.groundNormal.y).toBeCloseTo(Math.cos(rad(40)), 1);
  });

  it('rampa 53°: escorrega (não sobe nem fica grounded na rampa)', () => {
    const s = makeSim(-6, 0, -10, 90);
    settle(s);
    s.intent.dir.set(0, 1);
    // Na base a cápsula toca chão + rampa e o Octree devolve a normal AGREGADA
    // (levemente inclinada, ainda caminhável): grounded ali é legítimo. O que
    // não pode acontecer é ficar grounded ACIMA da base (subindo a rampa).
    let groundedOnSlope = 0;
    for (let i = 0; i < 2 * STEPS_PER_SECOND; i++) {
      step(s, 1);
      if (s.body.grounded && s.t.position.y > 0.3) groundedOnSlope++;
    }
    expect(s.maxY).toBeLessThan(1.5);
    expect(groundedOnSlope).toBe(0);
    expect(s.t.position.x).toBeGreaterThan(-9.5);
    expect(s.t.position.y).toBeLessThan(0.5);
  });

  it('rampa 20,6°: sobe até a plataforma e desce sem perder o chão (snap)', () => {
    const s = makeSim(-4, 0, 0, 90);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, 2 * STEPS_PER_SECOND);
    expect(s.t.position.x).toBeLessThan(-14);
    expect(s.t.position.y).toBeCloseTo(3, 1);
    expect(s.body.grounded).toBe(true);
    // Volta: para, vira e desce.
    s.intent.dir.set(0, 0);
    step(s, 15);
    s.intent.yaw = rad(-90);
    s.intent.dir.set(0, 1);
    s.airSteps = 0;
    step(s, 2 * STEPS_PER_SECOND);
    expect(s.t.position.x).toBeGreaterThan(-4);
    expect(s.t.position.y).toBeCloseTo(0, 1);
    expect(s.airSteps).toBeLessThanOrEqual(1);
  });

  it('pressionar contra parede no chão: bloqueia sem quicar (normal agregada chão+parede)', () => {
    // Parede oeste do corredor: face externa em x = −0,9 (z −25..−15). Vem de x = −4 andando para +X.
    const s = makeSim(-4, 0, -20, -90);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, 2 * STEPS_PER_SECOND);
    expect(s.t.position.x).toBeLessThan(-0.9 - MOVEMENT.capsuleRadius + 0.02);
    expect(s.t.position.x).toBeGreaterThan(-0.9 - MOVEMENT.capsuleRadius - 0.05);
    expect(s.body.grounded).toBe(true);
    expect(s.airSteps).toBe(0);
    expect(s.maxY).toBeLessThan(0.05);
    expect(s.body.velocity.y).toBeLessThanOrEqual(0);
  });

  it('degrau 0,25 m: step-up com velocidade preservada', () => {
    const s = makeSim(10, 0, 3, 0);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, STEPS_PER_SECOND);
    expect(s.t.position.z).toBeLessThan(-1.5);
    expect(s.t.position.y).toBeCloseTo(0.25, 2);
    expect(s.body.grounded).toBe(true);
    expect(s.maxY).toBeLessThan(0.3);
    expect(s.airSteps).toBeLessThanOrEqual(2);
    expect(s.minSpeedAfterAccel).toBeGreaterThan(4);
  });

  it('degrau 0,35 m (= stepHeight): step-up', () => {
    const s = makeSim(10, 0, 10, 0);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, STEPS_PER_SECOND);
    expect(s.t.position.z).toBeLessThan(5.5);
    expect(s.t.position.y).toBeCloseTo(0.35, 2);
    expect(s.body.grounded).toBe(true);
    expect(s.airSteps).toBeLessThanOrEqual(2);
    expect(s.minSpeedAfterAccel).toBeGreaterThan(4);
  });

  it('degrau 0,50 m: parede sem pulo; com pulo sobe', () => {
    const s = makeSim(10, 0, -2, 0);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, STEPS_PER_SECOND);
    expect(s.t.position.y).toBeLessThan(0.05);
    expect(s.t.position.z).toBeGreaterThan(-5 + MOVEMENT.capsuleRadius - 0.05);
    s.intent.jumpPressed = true;
    // 45 passos: já pousou em cima (≈ 37) e ainda não chegou à borda de trás (z = −9).
    step(s, 45);
    expect(s.t.position.z).toBeLessThan(-5.5);
    expect(s.t.position.y).toBeCloseTo(0.5, 2);
    expect(s.body.grounded).toBe(true);
  });

  it('corredor de 1,2 m: atravessa sem prender, mesmo entrando descentrado', () => {
    for (const startX of [0, 0.15, -0.15]) {
      const s = makeSim(startX, 0, -12, 0);
      settle(s);
      s.intent.dir.set(0, 1);
      step(s, 3 * STEPS_PER_SECOND);
      expect(s.t.position.z).toBeLessThan(-26);
      expect(Math.abs(s.t.position.x)).toBeLessThan(0.25);
      expect(s.body.grounded).toBe(true);
      expect(s.minSpeedAfterAccel).toBeGreaterThan(5);
    }
  });
});

describe('CollisionWorld.raycast', () => {
  const DOWN = new THREE.Vector3(0, -1, 0);
  const FORWARD_Z = new THREE.Vector3(0, 0, 1);

  it('acerta o chão com normal para cima, layer World e entity null', () => {
    const hit = makeRayHit();
    hit.entity = 7 as EntityId;
    expect(world.raycast(new THREE.Vector3(3, 5, 3), DOWN, 10, CollisionLayer.World, hit)).toBe(true);
    expect(hit.point.y).toBeCloseTo(0, 5);
    expect(hit.normal.y).toBeCloseTo(1, 5);
    expect(hit.distance).toBeCloseTo(5, 5);
    expect(hit.layer).toBe(CollisionLayer.World);
    expect(hit.entity).toBeNull();
  });

  it('respeita maxDist e a máscara', () => {
    const hit = makeRayHit();
    expect(world.raycast(new THREE.Vector3(3, 5, 3), DOWN, 4, CollisionLayer.World, hit)).toBe(false);
    expect(world.raycast(new THREE.Vector3(3, 5, 3), DOWN, 10, CollisionLayer.Enemy, hit)).toBe(false);
  });

  it('atravessa a caixa collider:false', () => {
    const hit = makeRayHit();
    expect(world.raycast(new THREE.Vector3(0, 1, 15), FORWARD_Z, 10, CollisionLayer.World, hit)).toBe(false);
  });

  it('acerta hitbox com entity e prefere o mais próximo', () => {
    const entity = 42 as EntityId;
    const capsule = new Capsule(new THREE.Vector3(5, 0.4, 20), new THREE.Vector3(5, 1.4, 20), 0.4);
    world.addHitbox({ entity, layer: CollisionLayer.Enemy, capsule });
    expect(world.hitboxCount).toBe(1);
    const hit = makeRayHit();
    const origin = new THREE.Vector3(5, 1, 15);
    expect(world.raycast(origin, FORWARD_Z, 10, CollisionLayer.World | CollisionLayer.Enemy, hit)).toBe(true);
    expect(hit.entity).toBe(entity);
    expect(hit.layer).toBe(CollisionLayer.Enemy);
    expect(hit.distance).toBeCloseTo(4.6, 5);
    expect(hit.normal.z).toBeCloseTo(-1, 5);
    // Só mundo: a hitbox é ignorada.
    expect(world.raycast(origin, FORWARD_Z, 10, CollisionLayer.World, hit)).toBe(false);
    // Chão mais perto que a hitbox: vence o mundo.
    const diag = new THREE.Vector3(0, -1, 1).normalize();
    expect(world.raycast(new THREE.Vector3(5, 0.5, 19), diag, 10, CollisionLayer.All, hit)).toBe(true);
    expect(hit.entity).toBeNull();
    world.removeHitbox(entity);
    expect(world.hitboxCount).toBe(0);
    expect(world.raycast(origin, FORWARD_Z, 10, CollisionLayer.All, hit)).toBe(false);
  });

  it('rampa: todas as faces do prisma têm normal para fora (backface culling do Octree)', () => {
    const hit = makeRayHit();
    // Topo inclinado da rampa de 20,6° (sobe para −X): normal.y = cos 20,6°, inclinada para +X.
    expect(world.raycast(new THREE.Vector3(-10, 5, 0), DOWN, 10, CollisionLayer.World, hit)).toBe(true);
    expect(hit.point.y).toBeCloseTo(1.5, 3);
    expect(hit.normal.y).toBeCloseTo(Math.cos(rad(20.6)), 2);
    expect(hit.normal.x).toBeGreaterThan(0.3);
    // Lateral (+Z) da rampa.
    const BACK_Z = new THREE.Vector3(0, 0, -1);
    expect(world.raycast(new THREE.Vector3(-10, 0.5, 5), BACK_Z, 10, CollisionLayer.World, hit)).toBe(true);
    expect(hit.point.z).toBeCloseTo(2, 3);
    expect(hit.normal.z).toBeCloseTo(1, 3);
    // Face vertical de trás (x = −14, normal −X), vista de dentro da plataforma (cujas faces são culled).
    const PLUS_X = new THREE.Vector3(1, 0, 0);
    expect(world.raycast(new THREE.Vector3(-15, 1, 0), PLUS_X, 10, CollisionLayer.World, hit)).toBe(true);
    expect(hit.point.x).toBeCloseTo(-14, 3);
    expect(hit.normal.x).toBeCloseTo(-1, 3);
  });

  it('bounds cobre o chão e debugHelper devolve os nós mesclados em 1 objeto na camada DEBUG', () => {
    expect(world.bounds.min.x).toBeLessThanOrEqual(-40);
    expect(world.bounds.max.x).toBeGreaterThanOrEqual(40);
    const helper = world.debugHelper();
    expect(helper).toBeInstanceOf(THREE.LineSegments);
    expect(helper.layers.mask).toBe(1 << 2);
    const nodes = helper.userData['nodeCount'];
    expect(typeof nodes === 'number' && nodes > 0).toBe(true);
    // 12 arestas × 2 vértices por nó, tudo numa geometria só (1 draw call).
    const position = (helper as THREE.LineSegments).geometry.getAttribute('position');
    expect(position.count).toBe(Number(nodes) * 24);
  });
});

describe('Campo de Provas (data/levels/test-ground) construído de verdade', () => {
  let tg: CollisionWorld;

  beforeAll(() => {
    tg = new CollisionWorld();
    tg.rebuildStatic(buildLevel(TEST_GROUND).collisionRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gera 4 meshes com colisão, sem erro de mescla, e o Octree cobre ±60 m', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const built = buildLevel(TEST_GROUND);
    expect(consoleError).not.toHaveBeenCalled();
    expect(built.collisionRoot.children.length).toBe(4);
    expect(built.stats.meshes).toBe(4);
    expect(built.stats.triangles).toBeGreaterThan(500);
    expect(built.stats.triangles).toBeLessThan(6000);
    expect(built.helpers.children.length).toBe(3);
    expect(built.playerSpawn.pos).toEqual([0, 0, 12]);
    expect(tg.bounds.min.x).toBeLessThanOrEqual(-60);
    expect(tg.bounds.max.z).toBeGreaterThanOrEqual(60);
  });

  it('spawn assenta em y = 0 e andar 1 s para a frente passa de z = 8 (critério do e2e)', () => {
    const s = makeSim(0, 0, 12, 0, tg);
    settle(s);
    expect(s.body.grounded).toBe(true);
    expect(s.t.position.y).toBeCloseTo(0, 2);
    s.intent.dir.set(0, 1);
    step(s, STEPS_PER_SECOND);
    expect(s.t.position.z).toBeLessThan(8);
    expect(s.body.grounded).toBe(true);
  });

  it('escada: sobe os 4 degraus de 0,25 m sem pular e chega a 1,0 m', () => {
    const s = makeSim(12, 0, -4, 0, tg);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, STEPS_PER_SECOND);
    expect(s.t.position.z).toBeLessThan(-9);
    expect(s.t.position.y).toBeCloseTo(1, 2);
    expect(s.body.grounded).toBe(true);
    expect(s.minSpeedAfterAccel).toBeGreaterThan(3.5);
  });

  it('corredor de 1,2 m em (0, 0, −26): atravessa', () => {
    const s = makeSim(0.1, 0, -18, 0, tg);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, 3 * STEPS_PER_SECOND);
    expect(s.t.position.z).toBeLessThan(-32);
    expect(s.body.grounded).toBe(true);
  });

  it('rampa suave chega à plataforma de 3 m; rampa íngreme não sobe', () => {
    const gentle = makeSim(-14, 0, 0, 90, tg);
    settle(gentle);
    gentle.intent.dir.set(0, 1);
    step(gentle, 2 * STEPS_PER_SECOND);
    expect(gentle.t.position.x).toBeLessThan(-24);
    expect(gentle.t.position.y).toBeCloseTo(3, 1);
    expect(gentle.body.grounded).toBe(true);

    const steep = makeSim(-14, 0, -8, 90, tg);
    settle(steep);
    steep.intent.dir.set(0, 1);
    step(steep, 2 * STEPS_PER_SECOND);
    expect(steep.maxY).toBeLessThan(1.5);
    expect(steep.t.position.x).toBeGreaterThan(-19.5);
  });

  it('rampa 40°: desce andando e em sprint sem perder o chão nem pousar', () => {
    for (const sprint of [false, true]) {
      const s = makeSim(-21.6, 3.1, 7, -90, tg);
      settle(s);
      s.intent.dir.set(0, 1);
      s.intent.sprint = sprint;
      step(s, 2 * STEPS_PER_SECOND);
      expect(s.airSteps, `sprint=${sprint}`).toBe(0);
      expect(s.landings, `sprint=${sprint}`).toBe(0);
      expect(s.body.grounded).toBe(true);
      expect(s.t.position.y).toBeCloseTo(0, 1);
      expect(s.t.position.x).toBeGreaterThan(-12);
    }
  });

  it('escada: desce os 4 degraus andando e em sprint sem ar nem pouso', () => {
    for (const sprint of [false, true]) {
      const s = makeSim(12, 1.0, -9.5, 180, tg);
      settle(s);
      s.intent.dir.set(0, 1);
      s.intent.sprint = sprint;
      step(s, 45);
      expect(s.airSteps, `sprint=${sprint}`).toBe(0);
      expect(s.landings, `sprint=${sprint}`).toBe(0);
      expect(s.body.grounded).toBe(true);
      expect(s.t.position.y).toBeCloseTo(0, 2);
      expect(s.t.position.z).toBeGreaterThan(-5.5);
    }
  });

  it('sair de um caixote de 1 m continua sendo queda (o snap não gruda 1 m)', () => {
    const s = makeSim(13, 1.0, 0, -90, tg);
    settle(s);
    s.intent.dir.set(0, 1);
    step(s, STEPS_PER_SECOND);
    expect(s.landings).toBe(1);
    expect(s.airSteps).toBeGreaterThanOrEqual(10);
    expect(s.t.position.y).toBeCloseTo(0, 2);
  });
});
