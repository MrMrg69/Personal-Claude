import { describe, expect, it } from 'vitest';
import { Random } from '@/core/math/random';

describe('Random (mulberry32)', () => {
  it('mesma seed → mesma sequência; seeds diferentes divergem', () => {
    const a = new Random(1234);
    const b = new Random(1234);
    const c = new Random(1235);
    const sa = Array.from({ length: 20 }, () => a.next());
    const sb = Array.from({ length: 20 }, () => b.next());
    const sc = Array.from({ length: 20 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });

  it('next fica em [0, 1) com média ≈ 0,5', () => {
    const r = new Random(42);
    const n = 20000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
  });

  it('range, int e pick respeitam os limites', () => {
    const r = new Random(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const f = r.range(-2, 3);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(3);
      const k = r.int(1, 6);
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(6);
      seen.add(k);
    }
    expect(seen.size).toBe(6);
    expect(['x', 'y']).toContain(r.pick(['x', 'y']));
    expect(() => r.pick([])).toThrow(RangeError);
  });
});
