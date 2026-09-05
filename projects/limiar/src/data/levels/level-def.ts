/**
 * Formato de nível (design §7). Um nível é DADO: world/level-builder.ts gera
 * as meshes e o Group de colisão; o mapa de patrulha do MVP usa o mesmo tipo.
 * Unidades em metros, Y para cima; `pos` é sempre o centro da BASE (pé).
 */
export type Vec3 = readonly [number, number, number];

export interface BoxDef {
  kind: 'box';
  pos: Vec3;
  /** (largura X, altura Y, profundidade Z) antes de rotY. */
  size: Vec3;
  color: number;
  /** Rotação em Y (graus). */
  rotY?: number;
  /** false = só visual (fica fora do Octree). Padrão true. */
  collider?: boolean;
  name?: string;
}

/**
 * Prisma: o topo sobe `rise` ao longo de `run` (projeção horizontal); ângulo =
 * atan(rise/run). Sobe na direção `dirYawDeg` (convenção de yaw: 0 → −Z,
 * 90 → −X). A aresta baixa fica em pos − dir·run/2 e a alta em pos + dir·run/2.
 */
export interface RampDef {
  kind: 'ramp';
  pos: Vec3;
  run: number;
  rise: number;
  width: number;
  dirYawDeg: number;
  color: number;
  name?: string;
}

export interface CylinderDef {
  kind: 'cylinder';
  pos: Vec3;
  radius: number;
  height: number;
  color: number;
  /** Faixas horizontais de baixo para cima (cor por vértice); ausente = cor única. */
  bands?: readonly number[];
  /** Segmentos radiais (padrão em level-builder). */
  segments?: number;
  name?: string;
}

export type PrimitiveDef = BoxDef | RampDef | CylinderDef;

export type SpawnTag = 'player' | 'enemy' | 'boss';

export interface SpawnPoint {
  pos: Vec3;
  /** Graus; 0 olha para −Z. */
  yawDeg: number;
  tag?: SpawnTag;
}

export interface LevelDef {
  id: string;
  name: string;
  props: readonly PrimitiveDef[];
  /** O primeiro com tag 'player' é o spawn inicial. */
  spawnPoints: readonly SpawnPoint[];
  /** Usados pela IA em M2 (vazio ok). */
  coverPoints: readonly Vec3[];
  /** Abaixo disto o jogador respawna (deve ser negativo). */
  killPlaneY: number;
  /** Meio-lado do mundo (m); grade de debug e validação de spawns. */
  bounds: { halfSize: number };
  debug?: { grid: boolean; axes: boolean };
}
