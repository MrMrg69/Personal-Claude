/**
 * EventBus tipado (design §3.4): `emit` síncrono para reações no mesmo frame
 * (recoil, hitmarker) e `queue`/`flush` para consequências que criam/removem
 * entidades — o loop chama flush() ao fim de cada passo fixo, fora das iterações.
 */

interface Listener<P> {
  fn: (p: P) => void;
  once: boolean;
  /** Marcado durante um emit (não pode remover do array em iteração); compactado depois. */
  dead: boolean;
}

/** Profundidade máxima de emits aninhados antes de considerar recursão infinita. */
const MAX_EMIT_DEPTH = 16;

/** Passadas máximas de flush quando handlers enfileiram novos eventos durante o flush. */
const MAX_FLUSH_PASSES = 64;

export class EventBus<E extends { [K in keyof E]: object }> {
  private readonly listeners = new Map<keyof E, Listener<E[keyof E]>[]>();
  private readonly queuedTypes: (keyof E)[] = [];
  private readonly queuedPayloads: E[keyof E][] = [];
  private depth = 0;
  private needsCompact = false;

  on<K extends keyof E>(type: K, fn: (p: E[K]) => void): () => void {
    return this.add(type, fn, false);
  }

  once<K extends keyof E>(type: K, fn: (p: E[K]) => void): () => void {
    return this.add(type, fn, true);
  }

  /** Síncrono. Emits aninhados são permitidos até MAX_EMIT_DEPTH; além disso lança. */
  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const list = this.listeners.get(type);
    if (!list || list.length === 0) return;
    if (this.depth >= MAX_EMIT_DEPTH) {
      throw new Error(`EventBus: recursão de emit além de ${MAX_EMIT_DEPTH} níveis em "${String(type)}"`);
    }
    this.depth++;
    try {
      // Comprimento capturado: handlers adicionados durante o emit só ouvem o próximo.
      const n = list.length;
      for (let i = 0; i < n; i++) {
        const l = list[i];
        if (!l || l.dead) continue;
        if (l.once) {
          l.dead = true;
          this.needsCompact = true;
        }
        l.fn(payload);
      }
    } finally {
      this.depth--;
      if (this.depth === 0 && this.needsCompact) this.compact();
    }
  }

  /** Entregue apenas em flush(). */
  queue<K extends keyof E>(type: K, payload: E[K]): void {
    this.queuedTypes.push(type);
    this.queuedPayloads.push(payload);
  }

  /** Entrega a fila (inclusive eventos enfileirados por handlers durante o flush). */
  flush(): void {
    let passes = 0;
    while (this.queuedTypes.length > 0) {
      if (++passes > MAX_FLUSH_PASSES) {
        throw new Error('EventBus: flush não converge (handlers enfileiram eventos sem parar)');
      }
      const n = this.queuedTypes.length;
      for (let i = 0; i < n; i++) {
        const type = this.queuedTypes[i];
        const payload = this.queuedPayloads[i];
        if (type !== undefined && payload !== undefined) this.emit(type, payload);
      }
      this.queuedTypes.splice(0, n);
      this.queuedPayloads.splice(0, n);
    }
  }

  clear(): void {
    this.listeners.clear();
    this.queuedTypes.length = 0;
    this.queuedPayloads.length = 0;
    this.needsCompact = false;
  }

  private add<K extends keyof E>(type: K, fn: (p: E[K]) => void, once: boolean): () => void {
    let list = this.listeners.get(type);
    if (!list) {
      list = [];
      this.listeners.set(type, list);
    }
    const entry: Listener<E[K]> = { fn, once, dead: false };
    list.push(entry as Listener<E[keyof E]>);
    return () => {
      if (entry.dead) return;
      entry.dead = true;
      if (this.depth > 0) {
        this.needsCompact = true;
      } else {
        const idx = list.indexOf(entry as Listener<E[keyof E]>);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  /** Remove entradas mortas in-place (sem alocar). */
  private compact(): void {
    this.needsCompact = false;
    for (const list of this.listeners.values()) {
      let w = 0;
      for (let r = 0; r < list.length; r++) {
        const l = list[r];
        if (l && !l.dead) {
          list[w++] = l;
        }
      }
      list.length = w;
    }
  }
}
