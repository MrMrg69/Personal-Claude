import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Layer } from '@/core/layers';
import { rad } from '@/core/math';
import type { BoxDef, CylinderDef, LevelDef, PrimitiveDef, RampDef, SpawnPoint } from '@/data/levels/level-def';
import { PALETTE } from '@/data/palette';
import { getMaterial } from './materials';

/**
 * Constrói o mundo estático de um LevelDef (design §7, §6.5): cada primitiva
 * vira geometria não indexada com cor por vértice; as geometrias são mescladas
 * por quadrante (≤ 4 meshes com colisão) para manter frustum culling com o
 * mínimo de draw calls. Primitivas com `collider: false` vão para uma mesh à
 * parte ("decor") que fica fora do Group de colisão.
 */
export interface BuiltLevel {
  /** Tudo que é renderizado: collisionRoot + decor. Adicione à cena. */
  staticRoot: THREE.Group;
  /** Só as meshes com colisão; alimenta CollisionWorld.rebuildStatic. Filho de staticRoot. */
  collisionRoot: THREE.Group;
  /** Grade/eixos na camada DEBUG (fora da mescla). Adicione à cena; F6 alterna a camada. */
  helpers: THREE.Group;
  playerSpawn: SpawnPoint;
  stats: { meshes: number; triangles: number };
}

/** Segmentos radiais padrão de um cilindro (silhueta low-poly legível). */
const DEFAULT_CYLINDER_SEGMENTS = 12;
/** Grade de debug: célula menor (m) e maior (m). */
const GRID_MINOR_CELL = 1;
const GRID_MAJOR_CELL = 10;
/** Altura da grade acima do chão para não brigar com o piso no z-buffer. */
const GRID_Y = 0.01;
const AXES_SIZE = 2;
const VERTICES_PER_TRIANGLE = 3;
const COMPONENTS_PER_COLOR = 3;

const scratchColor = new THREE.Color();
const scratchMatrix = new THREE.Matrix4();
const scratchQuat = new THREE.Quaternion();
const scratchPos = new THREE.Vector3();
const scratchScale = new THREE.Vector3(1, 1, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Atributo de cor constante (RGB linear, como o material espera). */
function solidColorAttribute(vertexCount: number, hex: number): THREE.BufferAttribute {
  scratchColor.setHex(hex);
  const arr = new Float32Array(vertexCount * COMPONENTS_PER_COLOR);
  for (let i = 0; i < vertexCount; i++) {
    arr[i * 3] = scratchColor.r;
    arr[i * 3 + 1] = scratchColor.g;
    arr[i * 3 + 2] = scratchColor.b;
  }
  return new THREE.BufferAttribute(arr, COMPONENTS_PER_COLOR);
}

/** Normaliza para o formato de mescla: não indexada, só position/normal/color. */
function finalize(geometry: THREE.BufferGeometry, color: THREE.BufferAttribute, rotYDeg: number, base: readonly [number, number, number]): THREE.BufferGeometry {
  geometry.deleteAttribute('uv');
  geometry.setAttribute('color', color);
  scratchQuat.setFromAxisAngle(Y_AXIS, rad(rotYDeg));
  scratchPos.set(base[0], base[1], base[2]);
  geometry.applyMatrix4(scratchMatrix.compose(scratchPos, scratchQuat, scratchScale));
  return geometry;
}

function buildBox(def: BoxDef): THREE.BufferGeometry {
  const [w, h, d] = def.size;
  // BoxGeometry é centrada; `pos` é o centro da base → sobe h/2 antes de rotacionar/transladar.
  const geometry = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).toNonIndexed();
  const color = solidColorAttribute(geometry.getAttribute('position').count, def.color);
  return finalize(geometry, color, def.rotY ?? 0, def.pos);
}

function buildCylinder(def: CylinderDef): THREE.BufferGeometry {
  const bands = def.bands ?? [def.color];
  const segments = def.segments ?? DEFAULT_CYLINDER_SEGMENTS;
  // heightSegments = nº de faixas: cada triângulo lateral cai inteiro dentro de uma faixa.
  const geometry = new THREE.CylinderGeometry(def.radius, def.radius, def.height, segments, bands.length)
    .translate(0, def.height / 2, 0)
    .toNonIndexed();
  const position = geometry.getAttribute('position');
  const arr = new Float32Array(position.count * COMPONENTS_PER_COLOR);
  const bandHeight = def.height / bands.length;
  for (let tri = 0; tri < position.count; tri += VERTICES_PER_TRIANGLE) {
    // Cor por triângulo pelo centróide: vértices na fronteira entre faixas não misturam cores.
    const centroidY = (position.getY(tri) + position.getY(tri + 1) + position.getY(tri + 2)) / VERTICES_PER_TRIANGLE;
    const band = Math.min(bands.length - 1, Math.max(0, Math.floor(centroidY / bandHeight)));
    scratchColor.setHex(bands[band] ?? def.color);
    for (let v = tri; v < tri + VERTICES_PER_TRIANGLE; v++) {
      arr[v * 3] = scratchColor.r;
      arr[v * 3 + 1] = scratchColor.g;
      arr[v * 3 + 2] = scratchColor.b;
    }
  }
  return finalize(geometry, new THREE.BufferAttribute(arr, COMPONENTS_PER_COLOR), 0, def.pos);
}

/**
 * Prisma triangular reto (5 faces, 8 triângulos) com enrolamento anti-horário
 * visto de fora — o Octree faz backface culling no raycast e a normal de
 * `triangle.getNormal` precisa apontar para fora. Local: sobe para −Z (yaw 0);
 * aresta baixa em z = +run/2, aresta alta em z = −run/2.
 */
function buildRamp(def: RampDef): THREE.BufferGeometry {
  const hw = def.width / 2;
  const hr = def.run / 2;
  const rise = def.rise;
  // Vértices: 0–3 base (y = 0), 4–5 topo da aresta alta (y = rise, z = −hr).
  const v = [
    [-hw, 0, hr], // 0: baixo, esquerda
    [hw, 0, hr], // 1: baixo, direita
    [hw, 0, -hr], // 2: alto (base), direita
    [-hw, 0, -hr], // 3: alto (base), esquerda
    [hw, rise, -hr], // 4: topo, direita
    [-hw, rise, -hr], // 5: topo, esquerda
  ] as const;
  // Triângulos CCW vistos de fora.
  const tris = [
    [0, 1, 4], [0, 4, 5], // rampa (inclinada, normal para +Y/+Z)
    [1, 2, 4], // lado direito (+X)
    [0, 5, 3], // lado esquerdo (−X)
    [2, 3, 5], [2, 5, 4], // face vertical de trás (−Z)
    [0, 3, 2], [0, 2, 1], // base (−Y)
  ] as const;
  const positions = new Float32Array(tris.length * VERTICES_PER_TRIANGLE * 3);
  let k = 0;
  for (const t of tris) {
    for (const idx of t) {
      const p = v[idx];
      positions[k++] = p[0];
      positions[k++] = p[1];
      positions[k++] = p[2];
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const color = solidColorAttribute(tris.length * VERTICES_PER_TRIANGLE, def.color);
  return finalize(geometry, color, def.dirYawDeg, def.pos);
}

function buildPrimitive(def: PrimitiveDef): THREE.BufferGeometry {
  switch (def.kind) {
    case 'box':
      return buildBox(def);
    case 'ramp':
      return buildRamp(def);
    case 'cylinder':
      return buildCylinder(def);
  }
}

/** Quadrante pelo sinal do centro da primitiva (chunks para frustum culling). */
function quadrantKey(def: PrimitiveDef): string {
  return `${def.pos[0] >= 0 ? 'e' : 'w'}${def.pos[2] >= 0 ? 's' : 'n'}`;
}

function mergeChunk(name: string, parts: THREE.BufferGeometry[]): THREE.Mesh {
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  if (!merged) throw new Error(`level-builder: falha ao mesclar o chunk '${name}'`);
  merged.computeBoundingSphere();
  const mesh = new THREE.Mesh(merged, getMaterial('world'));
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function buildHelpers(def: LevelDef): THREE.Group {
  const helpers = new THREE.Group();
  helpers.name = 'helpers';
  const size = def.bounds.halfSize * 2;
  if (def.debug?.grid) {
    const minor = new THREE.GridHelper(size, size / GRID_MINOR_CELL, PALETTE.gridMinor, PALETTE.gridMinor);
    const major = new THREE.GridHelper(size, size / GRID_MAJOR_CELL, PALETTE.gridMajor, PALETTE.gridMajor);
    minor.position.y = GRID_Y;
    major.position.y = GRID_Y * 2;
    helpers.add(minor, major);
  }
  if (def.debug?.axes) {
    const axes = new THREE.AxesHelper(AXES_SIZE);
    axes.position.y = GRID_Y * 2;
    helpers.add(axes);
  }
  helpers.traverse((obj) => obj.layers.set(Layer.DEBUG));
  return helpers;
}

export function buildLevel(def: LevelDef): BuiltLevel {
  const playerSpawn = def.spawnPoints.find((s) => s.tag === 'player');
  if (!playerSpawn) throw new Error(`level-builder: nível '${def.id}' sem spawn 'player'`);

  const chunks = new Map<string, THREE.BufferGeometry[]>();
  const decor: THREE.BufferGeometry[] = [];
  for (const prop of def.props) {
    const geometry = buildPrimitive(prop);
    if (prop.kind === 'box' && prop.collider === false) {
      decor.push(geometry);
      continue;
    }
    const key = quadrantKey(prop);
    let list = chunks.get(key);
    if (!list) {
      list = [];
      chunks.set(key, list);
    }
    list.push(geometry);
  }

  const staticRoot = new THREE.Group();
  staticRoot.name = `level:${def.id}`;
  const collisionRoot = new THREE.Group();
  collisionRoot.name = 'static';
  staticRoot.add(collisionRoot);

  let triangles = 0;
  let meshes = 0;
  for (const [key, parts] of chunks) {
    const mesh = mergeChunk(`static-${key}`, parts);
    collisionRoot.add(mesh);
    triangles += mesh.geometry.getAttribute('position').count / VERTICES_PER_TRIANGLE;
    meshes++;
  }
  if (decor.length > 0) {
    const mesh = mergeChunk('decor', decor);
    staticRoot.add(mesh);
    triangles += mesh.geometry.getAttribute('position').count / VERTICES_PER_TRIANGLE;
    meshes++;
  }

  return { staticRoot, collisionRoot, helpers: buildHelpers(def), playerSpawn, stats: { meshes, triangles } };
}
