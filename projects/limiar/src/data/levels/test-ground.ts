import { PALETTE } from '../palette';
import type { BoxDef, CylinderDef, LevelDef, PrimitiveDef, RampDef, SpawnPoint, Vec3 } from './level-def';

/**
 * Campo de Provas (design §7): o mundo de teste de M0. Cada elemento existe
 * para exercitar uma regra do controlador (step-up, rampas, pulo de toque vs.
 * segurado, corredor apertado, queda alta) ou a leitura visual a distância.
 *
 * Convenções: 1 u = 1 m; `pos` é o centro da base; spawn em (0, 0, 12) olhando −Z.
 */

function box(pos: Vec3, size: Vec3, color: number, extra: Partial<Omit<BoxDef, 'kind' | 'pos' | 'size' | 'color'>> = {}): BoxDef {
  return { kind: 'box', pos, size, color, ...extra };
}

function ramp(pos: Vec3, run: number, rise: number, width: number, dirYawDeg: number, color: number, name: string): RampDef {
  return { kind: 'ramp', pos, run, rise, width, dirYawDeg, color, name };
}

/** Espessura das lajes do chão (m); o topo fica em y = 0. */
const FLOOR_THICKNESS = 1;
const HALF_SIZE = 60;
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.5;

/** Chão em 4 lajes deixando um buraco 4×4 centrado em (20, 20) → kill plane. */
const FLOOR: readonly BoxDef[] = [
  box([-21, -FLOOR_THICKNESS, 0], [78, FLOOR_THICKNESS, 120], PALETTE.ochre, { name: 'floor-west' }),
  box([41, -FLOOR_THICKNESS, 0], [38, FLOOR_THICKNESS, 120], PALETTE.ochre, { name: 'floor-east' }),
  box([20, -FLOOR_THICKNESS, -21], [4, FLOOR_THICKNESS, 78], PALETTE.terracotta, { name: 'floor-gap-south' }),
  box([20, -FLOOR_THICKNESS, 41], [4, FLOOR_THICKNESS, 38], PALETTE.terracotta, { name: 'floor-gap-north' }),
];

/** Paredes de borda em ±60 (um pouco mais compridas para fechar os cantos). */
const BORDER: readonly BoxDef[] = [
  box([0, 0, -HALF_SIZE], [2 * HALF_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS], PALETTE.warmGray, { name: 'border-n' }),
  box([0, 0, HALF_SIZE], [2 * HALF_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS], PALETTE.warmGray, { name: 'border-s' }),
  box([-HALF_SIZE, 0, 0], [WALL_THICKNESS, WALL_HEIGHT, 2 * HALF_SIZE + WALL_THICKNESS], PALETTE.warmGray, { name: 'border-w' }),
  box([HALF_SIZE, 0, 0], [WALL_THICKNESS, WALL_HEIGHT, 2 * HALF_SIZE + WALL_THICKNESS], PALETTE.warmGray, { name: 'border-e' }),
];

/** Régua de 1/2/3 m e "poste humano" de 1,80 m (4 blocos de 0,45 m). */
const REFERENCES: readonly BoxDef[] = [
  box([-6, 0, 8], [0.3, 1, 0.3], PALETTE.propBone, { name: 'ruler-1m' }),
  box([-5, 0, 8], [0.3, 2, 0.3], PALETTE.propSlate, { name: 'ruler-2m' }),
  box([-4, 0, 8], [0.3, 3, 0.3], PALETTE.wardenCyan, { name: 'ruler-3m' }),
  box([3, 0, 8], [0.12, 0.45, 0.12], PALETTE.propInk, { name: 'human-post-0' }),
  box([3, 0.45, 8], [0.12, 0.45, 0.12], PALETTE.propBone, { name: 'human-post-1' }),
  box([3, 0.9, 8], [0.12, 0.45, 0.12], PALETTE.propInk, { name: 'human-post-2' }),
  box([3, 1.35, 8], [0.12, 0.45, 0.12], PALETTE.propBone, { name: 'human-post-3' }),
];

/**
 * Muretas de cobertura (2,0×1,1×0,5) em arco côncavo voltado para o spawn,
 * de (±8, −4) a (±2, −16); rotY tangente ao arco. Cobrem de peito (agachado em M1).
 */
const COVER_WALL_SIZE: Vec3 = [2, 1.1, 0.5];
const COVER_WALL_ARC: readonly { x: number; z: number; rotY: number }[] = [
  { x: -8, z: -4, rotY: 63.4 },
  { x: -5, z: -10, rotY: 63.4 },
  { x: -2, z: -16, rotY: 0 },
  { x: 2, z: -16, rotY: 0 },
  { x: 5, z: -10, rotY: -63.4 },
  { x: 8, z: -4, rotY: -63.4 },
];
const COVER_WALLS: readonly BoxDef[] = COVER_WALL_ARC.map((c, i) =>
  box([c.x, 0, c.z], COVER_WALL_SIZE, PALETTE.warmGrayLight, { rotY: c.rotY, name: `cover-${i}` }),
);
/** Ponto de cobertura 1 m atrás de cada mureta (lado oposto ao spawn). */
const COVER_POINTS: readonly Vec3[] = COVER_WALL_ARC.map((c) => [c.x, 0, c.z - 1] as const);

/** Pilares nos cantos (cobertura em pé, strafe-peek) e muro longo (deslizar lateral). */
const PILLARS: readonly BoxDef[] = [
  box([-16, 0, -16], [1, 2.6, 1], PALETTE.warmGrayDark, { name: 'pillar-sw' }),
  box([16, 0, -16], [1, 2.6, 1], PALETTE.warmGrayDark, { name: 'pillar-se' }),
  box([-16, 0, 16], [1, 2.6, 1], PALETTE.warmGrayDark, { name: 'pillar-nw' }),
  box([16, 0, 16], [1, 2.6, 1], PALETTE.warmGrayDark, { name: 'pillar-ne' }),
  // Movido de z = −8 (design) para z = 4: em −8 cruzava a rampa íngreme (−20, 0, −8).
  box([-14, 0, 4], [12, 3.2, 0.4], PALETTE.warmGray, { name: 'long-wall' }),
];

/** Caixotes de 1 m: pulo de toque sobe 1; pilha de 2 exige pulo segurado. */
const CRATE: Vec3 = [1, 1, 1];
const CRATE_SINGLES: readonly [number, number][] = [
  [8, 2], [10, 2], [12, 2], [8, -2], [12, -2], [9, 4], [11, 4], [13, 0],
];
const CRATE_STACKS: readonly [number, number][] = [[10, 0], [10, -3]];
const CRATES: readonly BoxDef[] = [
  ...CRATE_SINGLES.map(([x, z], i) => box([x, 0, z], CRATE, i % 2 === 0 ? PALETTE.propSand : PALETTE.propClay, { name: `crate-${i}` })),
  ...CRATE_STACKS.flatMap(([x, z], i) => [
    box([x, 0, z], CRATE, PALETTE.propClay, { name: `stack-${i}-0` }),
    box([x, 1, z], CRATE, PALETTE.propSand, { name: `stack-${i}-1` }),
  ]),
];

/** Blocos grandes 3×2,5×3: colisão lateral em quinas. */
const BIG_BLOCKS: readonly BoxDef[] = [
  box([14, 0, 10], [3, 2.5, 3], PALETTE.propSlate, { name: 'block-0' }),
  box([-10, 0, 14], [3, 2.5, 3], PALETTE.propSlate, { name: 'block-1' }),
  box([10, 0, -24], [3, 2.5, 3], PALETTE.propSlate, { name: 'block-2' }),
];

/**
 * Escada em (12, 0, −6..−10): degraus de 0,25 m subindo para −Z (cada um é
 * step-up direto); pela lateral, o degrau de 0,50 m só se sobe com pulo.
 */
const STAIRS: readonly BoxDef[] = [0.25, 0.5, 0.75, 1.0].map((h, i) =>
  box([12, 0, -6.5 - i], [3, h, 1], i % 2 === 0 ? PALETTE.propMoss : PALETTE.propSand, { name: `stair-${i}` }),
);

/** Rampas subindo para −X (dirYawDeg 90): 20,6° (chão), 40° (limite, chão), 53° (parede). */
const RAMPS: readonly PrimitiveDef[] = [
  ramp([-20, 0, 0], 8, 3, 4, 90, PALETTE.propClay, 'ramp-gentle'),
  box([-26, 0, 0], [4, 3, 4], PALETTE.propClay, { name: 'ramp-gentle-platform' }),
  ramp([-20, 0, 8], 4, 3.36, 3, 90, PALETTE.propMoss, 'ramp-limit'),
  ramp([-20, 0, -8], 3, 4, 3, 90, PALETTE.rustOrange, 'ramp-steep'),
];

/** Plataformas de pulo: 1,2 m (toque), 1,8 m (segurado), 2,6 m (só Investida, M3). */
const JUMP_PLATFORMS: readonly BoxDef[] = [
  box([-6, 0, -14], [2, 1.2, 2], PALETTE.propBone, { name: 'platform-1.2' }),
  box([-9, 0, -14], [2, 1.8, 2], PALETTE.propSand, { name: 'platform-1.8' }),
  box([-12, 0, -14], [2, 2.6, 2], PALETTE.propClay, { name: 'platform-2.6' }),
];

/** Torre de 6 m (queda alta) e corredor de 1,2 m (cápsula de 0,8 m sem prender). */
const TOWER_POS: Vec3 = [24, 0, -20];
const TOWER_SIZE: Vec3 = [4, 6, 4];
const CORRIDOR_GAP = 1.2;
const CORRIDOR_WALL: Vec3 = [0.3, 3, 10];
const STRUCTURES: readonly BoxDef[] = [
  box(TOWER_POS, TOWER_SIZE, PALETTE.warmGrayLight, { name: 'tower' }),
  box([-(CORRIDOR_GAP + CORRIDOR_WALL[0]) / 2, 0, -26], CORRIDOR_WALL, PALETTE.warmGrayDark, { name: 'corridor-w' }),
  box([(CORRIDOR_GAP + CORRIDOR_WALL[0]) / 2, 0, -26], CORRIDOR_WALL, PALETTE.warmGrayDark, { name: 'corridor-e' }),
];

/** Topo da torre (+5 cm): alvo do teleporte de debug (tecla T). */
export const TEST_GROUND_TOWER_TOP: Vec3 = [TOWER_POS[0], TOWER_POS[1] + TOWER_SIZE[1] + 0.05, TOWER_POS[2]];

/** Alvos cilíndricos a 10/20/30/45/60 m do spawn com 3 faixas (silhueta a distância; hitscan em M1). */
const TARGET_BANDS: readonly number[] = [PALETTE.rarityCommon, PALETTE.wardenCyan, PALETTE.tideMagenta];
const TARGETS: readonly CylinderDef[] = [2, -8, -18, -33, -48].map((z, i) => ({
  kind: 'cylinder',
  pos: [6, 0, z],
  radius: 0.25,
  height: 1.8,
  color: PALETTE.rarityCommon,
  bands: TARGET_BANDS,
  segments: 12,
  name: `target-${i}`,
}));

const SPAWN_POINTS: readonly SpawnPoint[] = [
  { pos: [0, 0, 12], yawDeg: 0, tag: 'player' },
  { pos: [-15, 0, -30], yawDeg: 180, tag: 'enemy' },
  { pos: [15, 0, -30], yawDeg: 180, tag: 'enemy' },
  { pos: [-30, 0, -45], yawDeg: 180, tag: 'enemy' },
  { pos: [30, 0, -45], yawDeg: 180, tag: 'enemy' },
];

export const TEST_GROUND = {
  id: 'test-ground',
  name: 'Campo de Provas',
  props: [
    ...FLOOR,
    ...BORDER,
    ...REFERENCES,
    ...COVER_WALLS,
    ...PILLARS,
    ...CRATES,
    ...BIG_BLOCKS,
    ...STAIRS,
    ...RAMPS,
    ...JUMP_PLATFORMS,
    ...STRUCTURES,
    ...TARGETS,
  ],
  spawnPoints: SPAWN_POINTS,
  coverPoints: COVER_POINTS,
  killPlaneY: -20,
  bounds: { halfSize: HALF_SIZE },
  debug: { grid: true, axes: true },
} satisfies LevelDef;
