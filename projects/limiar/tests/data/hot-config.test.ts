import { describe, expect, it } from 'vitest';
import { keepLive, onConfigHotUpdate } from '@/data/hot-config';

/** Contexto HMR mínimo: só `data` é usado por keepLive. */
function fakeHot(): ImportMeta['hot'] {
  return { data: {} } as unknown as ImportMeta['hot'];
}

describe('keepLive (HMR de configs)', () => {
  it('sem hot (produção) devolve o próprio objeto', () => {
    const fresh = { a: 1 };
    expect(keepLive(undefined, 'x', fresh)).toBe(fresh);
  });

  it('mantém a MESMA referência em três "edições" seguidas e copia os valores', () => {
    const hot = fakeHot();
    const v1 = keepLive(hot, 'movement', { walkSpeed: 6 });
    const v2 = keepLive(hot, 'movement', { walkSpeed: 7 });
    const v3 = keepLive(hot, 'movement', { walkSpeed: 8 });
    expect(v2).toBe(v1);
    expect(v3).toBe(v1);
    expect(v1.walkSpeed).toBe(8);
  });

  it('chaves diferentes não se misturam', () => {
    const hot = fakeHot();
    const a = keepLive(hot, 'a', { v: 1 });
    const b = keepLive(hot, 'b', { v: 2 });
    expect(a).not.toBe(b);
    expect(keepLive(hot, 'a', { v: 3 })).toBe(a);
    expect(b.v).toBe(2);
  });

  it('usa o assign fornecido (preserva referências aninhadas) e avisa os ouvintes só na substituição', () => {
    const hot = fakeHot();
    const keys: string[] = [];
    const off = onConfigHotUpdate((k) => keys.push(k));
    const assignNested = (live: { inner: { x: number } }, fresh: { inner: { x: number } }) => Object.assign(live.inner, fresh.inner);
    const first = keepLive(hot, 'feel', { inner: { x: 1 } }, assignNested);
    expect(keys).toEqual([]);
    const inner = first.inner;
    keepLive(hot, 'feel', { inner: { x: 2 } }, assignNested);
    expect(first.inner).toBe(inner);
    expect(inner.x).toBe(2);
    expect(keys).toEqual(['feel']);
    off();
    keepLive(hot, 'feel', { inner: { x: 3 } }, assignNested);
    expect(keys).toEqual(['feel']);
  });
});
