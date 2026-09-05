import * as THREE from 'three';
import type { Capsule } from 'three/addons/math/Capsule.js';

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolação exponencial independente de frame rate (= MathUtils.damp):
 * lambda ≈ 1/tempo característico; 10 → ~0,15 s para chegar a 78 %.
 */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

/**
 * Move as componentes X/Z de `v` em direção a (targetX, targetZ) no máximo
 * `maxDelta` (comprimento no plano). Y não é tocado. Sem alocação.
 */
export function moveTowardsVec2XZ(v: THREE.Vector3, targetX: number, targetZ: number, maxDelta: number): THREE.Vector3 {
  const dx = targetX - v.x;
  const dz = targetZ - v.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= maxDelta || dist === 0) {
    v.x = targetX;
    v.z = targetZ;
    return v;
  }
  const k = maxDelta / dist;
  v.x += dx * k;
  v.z += dz * k;
  return v;
}

/** Radianos → graus. */
export function deg(radians: number): number {
  return radians * THREE.MathUtils.RAD2DEG;
}

/** Graus → radianos. */
export function rad(degrees: number): number {
  return degrees * THREE.MathUtils.DEG2RAD;
}

export function snapToGrid(v: number, cell: number): number {
  return Math.round(v / cell) * cell;
}

/** Resultado mínimo de um raio; RayHit de physics/collision-query é compatível. */
export interface RayContact {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
}

/** Abaixo disto o eixo da cápsula é tratado como esfera (start ≈ end) ou o raio como paralelo. */
const PARALLEL_EPS = 1e-9;

const scratchBA = new THREE.Vector3();
const scratchOA = new THREE.Vector3();
const scratchOB = new THREE.Vector3();

/** Interseção raio × esfera; devolve t ≥ 0 ou -1. `oc` = origem − centro. */
function raySphereT(oc: THREE.Vector3, dir: THREE.Vector3, radius: number): number {
  const b = dir.dot(oc);
  const c = oc.dot(oc) - radius * radius;
  const h = b * b - c;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : -1;
}

/**
 * Raio × cápsula analítico (corpo cilíndrico + duas calotas). `dir` deve estar
 * normalizado. Origem dentro da cápsula conta como "sem acerto" (t < 0).
 * Usado pelo raycast contra hitboxes de entidades (design §5.2).
 */
export function rayCapsule(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  capsule: Capsule,
  maxDist: number,
  out: RayContact,
): boolean {
  const ba = scratchBA.subVectors(capsule.end, capsule.start);
  const oa = scratchOA.subVectors(origin, capsule.start);
  const r = capsule.radius;
  const baba = ba.dot(ba);
  let t = -1;

  if (baba < PARALLEL_EPS) {
    // start == end: esfera.
    t = raySphereT(oa, dir, r);
  } else {
    const bard = ba.dot(dir);
    const baoa = ba.dot(oa);
    const rdoa = dir.dot(oa);
    const oaoa = oa.dot(oa);
    const a = baba - bard * bard;
    const b = baba * rdoa - baoa * bard;
    const c = baba * oaoa - baoa * baoa - r * r * baba;
    const h = b * b - a * c;
    if (a < PARALLEL_EPS) {
      // Raio paralelo ao eixo: só as calotas podem ser atingidas.
      const tA = raySphereT(oa, dir, r);
      const tB = raySphereT(scratchOB.subVectors(origin, capsule.end), dir, r);
      t = tA < 0 ? tB : tB < 0 ? tA : Math.min(tA, tB);
    } else if (h >= 0) {
      const tBody = (-b - Math.sqrt(h)) / a;
      const y = baoa + tBody * bard;
      if (y > 0 && y < baba) {
        t = tBody >= 0 ? tBody : -1;
      } else {
        const oc = y <= 0 ? oa : scratchOB.subVectors(origin, capsule.end);
        t = raySphereT(oc, dir, r);
      }
    }
  }

  if (t < 0 || t > maxDist) return false;
  out.distance = t;
  out.point.copy(dir).multiplyScalar(t).add(origin);
  // Normal: do ponto mais próximo do eixo até o ponto de contato.
  const pa = scratchOA.subVectors(out.point, capsule.start);
  const hAxis = baba < PARALLEL_EPS ? 0 : clamp(pa.dot(ba) / baba, 0, 1);
  out.normal.copy(pa).addScaledVector(ba, -hAxis).divideScalar(r);
  return true;
}
