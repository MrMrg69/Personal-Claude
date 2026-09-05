import * as THREE from 'three';

/**
 * Cache de materiais compartilhados (design §6.1). Um único material para todo
 * o mundo estático é o que permite mesclar as geometrias em poucas draw calls.
 * Flat shading + cor por vértice = "papel dobrado", sem texturas nem PBR.
 */
export type MaterialKey = 'world';

const FACTORIES: Readonly<Record<MaterialKey, () => THREE.Material>> = {
  world: () => new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true }),
};

const cache = new Map<MaterialKey, THREE.Material>();

export function getMaterial(key: MaterialKey): THREE.Material {
  let m = cache.get(key);
  if (!m) {
    m = FACTORIES[key]();
    m.name = key;
    cache.set(key, m);
  }
  return m;
}

/** Libera os programas GPU (troca de cena/contexto). */
export function disposeMaterials(): void {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}
