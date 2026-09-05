/**
 * RNG determinístico (mulberry32): mesma seed → mesma sequência, em qualquer
 * runtime. Loot com rolagem reprodutível em teste depende disso (design §3.6).
 */
export class Random {
  readonly seed: number;
  private state: number;

  constructor(seed: number) {
    this.seed = seed;
    this.state = seed >>> 0;
  }

  /** Uniforme em [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniforme em [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Inteiro uniforme em [min, max] (inclusivo). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('Random.pick: array vazio');
    return arr[Math.floor(this.next() * arr.length)] as T;
  }
}
