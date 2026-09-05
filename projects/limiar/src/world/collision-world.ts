import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Octree } from 'three/addons/math/Octree.js';
import type { EntityId } from '@/core/entity';
import { Layer } from '@/core/layers';
import { rayCapsule, type RayContact } from '@/core/math';
import type { CapsuleHit, CollisionQuery, RayHit } from '@/core/physics/collision-query';
import { CollisionLayer, type CollisionMask } from '@/core/physics/layers';

/** Volume de acerto de uma entidade; esfera = cápsula com start = end. */
export interface Hitbox {
  entity: EntityId;
  layer: CollisionMask;
  capsule: Capsule;
}

const DEBUG_NODE_COLOR = 0x3fd2c7;

const ray = new THREE.Ray();
const contact: RayContact = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0 };

/**
 * Mundo de colisão (design §5.2): cápsula × Octree de triângulos do mundo
 * estático + hitboxes analíticas de entidades para raycast com máscara.
 * Implementa CollisionQuery para que core/physics não conheça o Octree —
 * a migração para three-mesh-bvh (ADR 0003) troca só este arquivo.
 *
 * Nota: Octree.capsuleIntersect/rayIntersect alocam internamente (arrays de
 * triângulos e objeto de resultado). É o custo aceito de usar o addon oficial
 * sem cópia; é também um dos gatilhos de migração.
 */
export class CollisionWorld implements CollisionQuery {
  private octree = new Octree();
  private readonly hitboxes: Hitbox[] = [];

  /** Caixa envolvente do mundo estático (vazia antes de rebuildStatic). */
  get bounds(): THREE.Box3 {
    return this.octree.bounds;
  }

  /** Reconstrói o Octree a partir de todas as meshes sob `root` (build único no carregamento). */
  rebuildStatic(root: THREE.Object3D): void {
    // Octree novo em vez de clear(): clear() zera `box`, mas subárvores antigas
    // sobreviveriam a um fromGraphNode seguido; começar limpo é mais barato que auditar.
    this.octree = new Octree();
    this.octree.fromGraphNode(root);
  }

  capsuleIntersect(c: Capsule, out: CapsuleHit): boolean {
    const r = this.octree.capsuleIntersect(c);
    if (!r) return false;
    out.normal.copy(r.normal);
    out.depth = r.depth;
    return true;
  }

  /**
   * Raio contra o mundo (mask & World) e contra cada hitbox cujo layer casa com
   * a máscara; devolve o acerto mais próximo. `dir` normalizado. A normal do
   * mundo vem de `triangle.getNormal` — com o backface culling do rayIntersect
   * ela já aponta para o lado de onde o raio veio (fora da superfície).
   */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, mask: CollisionMask, out: RayHit): boolean {
    let best = maxDist;
    let found = false;

    if (mask & CollisionLayer.World) {
      ray.set(origin, dir);
      const r = this.octree.rayIntersect(ray);
      if (r && r.distance <= best) {
        best = r.distance;
        found = true;
        out.point.copy(r.position);
        r.triangle.getNormal(out.normal);
        out.distance = r.distance;
        out.layer = CollisionLayer.World;
        out.entity = null;
      }
    }

    for (let i = 0; i < this.hitboxes.length; i++) {
      const h = this.hitboxes[i];
      if (!h || (h.layer & mask) === 0) continue;
      if (!rayCapsule(origin, dir, h.capsule, best, contact)) continue;
      best = contact.distance;
      found = true;
      out.point.copy(contact.point);
      out.normal.copy(contact.normal);
      out.distance = contact.distance;
      out.layer = h.layer;
      out.entity = h.entity;
    }

    return found;
  }

  /** A cápsula é guardada por referência: quem move a entidade atualiza o volume. */
  addHitbox(h: Hitbox): void {
    if (this.hitboxes.some((x) => x.entity === h.entity)) {
      throw new Error(`CollisionWorld: hitbox da entidade ${h.entity} já registrada`);
    }
    this.hitboxes.push(h);
  }

  removeHitbox(entity: EntityId): void {
    const idx = this.hitboxes.findIndex((x) => x.entity === entity);
    if (idx >= 0) this.hitboxes.splice(idx, 1);
  }

  get hitboxCount(): number {
    return this.hitboxes.length;
  }

  /**
   * Arestas de todos os nós do Octree em UM LineSegments (camada DEBUG, F6).
   * O Campo de Provas tem ~8k nós: um Box3Helper por nó seriam 8k draw calls
   * (inutilizável); mesclado é 1 draw call. Aloca; só sob demanda.
   */
  debugHelper(): THREE.Object3D {
    const boxes: THREE.Box3[] = [];
    collectNodeBoxes(this.octree, boxes);
    const positions = new Float32Array(boxes.length * BOX_EDGES.length * 2 * 3);
    let k = 0;
    for (const box of boxes) {
      for (const [a, b] of BOX_EDGES) {
        k = writeCorner(positions, k, box, a);
        k = writeCorner(positions, k, box, b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: DEBUG_NODE_COLOR }));
    lines.name = 'octree-debug';
    lines.userData['nodeCount'] = boxes.length;
    lines.layers.set(Layer.DEBUG);
    return lines;
  }
}

/** 12 arestas de uma caixa; índice de canto = bits (x, y, z) com 1 = max. */
const BOX_EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

function writeCorner(out: Float32Array, k: number, box: THREE.Box3, corner: number): number {
  out[k] = corner & 4 ? box.max.x : box.min.x;
  out[k + 1] = corner & 2 ? box.max.y : box.min.y;
  out[k + 2] = corner & 1 ? box.max.z : box.min.z;
  return k + 3;
}

function collectNodeBoxes(node: Octree, out: THREE.Box3[]): void {
  if (node.box && !node.box.isEmpty()) out.push(node.box);
  for (const sub of node.subTrees) collectNodeBoxes(sub, out);
}
