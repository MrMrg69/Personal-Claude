import type * as THREE from 'three';

/** Id opaco: impede passar um número qualquer onde se espera uma entidade. */
export type EntityId = number & { readonly __brand: 'EntityId' };

export interface Transform {
  /** Pés da entidade, em metros. */
  position: THREE.Vector3;
  /** Posição no passo anterior, para interpolação no render. */
  prevPosition: THREE.Vector3;
  /** rad; o corpo gira só em Y (pitch fica na cabeça, ver rig §5.3). */
  yaw: number;
}

export interface EntityBase {
  readonly id: EntityId;
  /** Discriminador; cada kind tem sua interface em entities/. */
  readonly kind: string;
  /** false = removida no próximo flushRemovals(). */
  alive: boolean;
  transform: Transform;
  /** Presença visual opcional. */
  view?: THREE.Object3D;
}

let nextEntityId = 1;

export function allocEntityId(): EntityId {
  return nextEntityId++ as EntityId;
}

/**
 * Armazém de entidades tipadas por kind (design §3.1). Remoções são adiadas
 * para flushRemovals() — chamado pelo loop ao fim do passo fixo — para que
 * sistemas iterem listas estáveis.
 */
export class EntityStore<E extends EntityBase> {
  private readonly byId = new Map<EntityId, E>();
  private readonly byKind = new Map<string, E[]>();
  private readonly pendingRemoval: EntityId[] = [];

  /** Efetivo imediatamente. */
  add<T extends E>(e: T): T {
    if (this.byId.has(e.id)) {
      throw new Error(`EntityStore: id ${e.id} já registrado`);
    }
    this.byId.set(e.id, e);
    this.listFor(e.kind).push(e);
    return e;
  }

  /** Marca alive=false; sai das listas em flushRemovals(). */
  remove(id: EntityId): void {
    const e = this.byId.get(id);
    if (!e || !e.alive) return;
    e.alive = false;
    this.pendingRemoval.push(id);
  }

  get(id: EntityId): E | undefined {
    return this.byId.get(id);
  }

  /** Array estável por kind (mesma referência entre chamadas). */
  ofKind<K extends E['kind']>(kind: K): readonly Extract<E, { kind: K }>[] {
    return this.listFor(kind) as unknown as readonly Extract<E, { kind: K }>[];
  }

  all(): Iterable<E> {
    return this.byId.values();
  }

  flushRemovals(): void {
    for (let i = 0; i < this.pendingRemoval.length; i++) {
      const id = this.pendingRemoval[i];
      if (id === undefined) continue;
      const e = this.byId.get(id);
      if (!e) continue;
      this.byId.delete(id);
      const list = this.listFor(e.kind);
      const idx = list.indexOf(e);
      // splice (não swap-remove) preserva a ordem de inserção, que é a ordem de atualização.
      if (idx >= 0) list.splice(idx, 1);
    }
    this.pendingRemoval.length = 0;
  }

  get size(): number {
    return this.byId.size;
  }

  private listFor(kind: string): E[] {
    let list = this.byKind.get(kind);
    if (!list) {
      list = [];
      this.byKind.set(kind, list);
    }
    return list;
  }
}
