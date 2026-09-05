import { describe, expect, it } from 'vitest';
import { Spring } from '@/core/math/spring';

const DT = 1 / 60;

describe('Spring', () => {
  it('não diverge com frames longos (ω·dt = 2,6: sub-passos internos)', () => {
    const s = new Spring(0.55, 26);
    s.kick(1.2 * 26);
    let maxAbs = 0;
    for (let i = 0; i < 30; i++) {
      s.step(0.1);
      maxAbs = Math.max(maxAbs, Math.abs(s.value));
    }
    expect(Number.isFinite(s.value)).toBe(true);
    expect(maxAbs).toBeLessThan(1.5);
    expect(Math.abs(s.value)).toBeLessThan(1e-3);
  });

  it('converge para o alvo a partir de um deslocamento', () => {
    const s = new Spring(0.6, 22);
    s.value = 1;
    for (let i = 0; i < 120; i++) s.step(DT);
    expect(Math.abs(s.value)).toBeLessThan(1e-3);
    expect(Math.abs(s.velocity)).toBeLessThan(1e-2);
  });

  it('kick produz pico e retorna com overshoot pequeno em ζ = 0,6', () => {
    const s = new Spring(0.6, 22);
    s.kick(2.5 * 22);
    let peak = 0;
    let minAfterPeak = 0;
    let peaked = false;
    for (let i = 0; i < 120; i++) {
      s.step(DT);
      if (!peaked) {
        if (s.value > peak) peak = s.value;
        else peaked = true;
      } else if (s.value < minAfterPeak) {
        minAfterPeak = s.value;
      }
    }
    // Pico analítico para v0 = 2,5·ω, ζ 0,6: ≈ 0,76 (v0/ω · fator de amortecimento).
    expect(peak).toBeGreaterThan(0.5);
    expect(peak).toBeLessThan(1);
    // Razão analítica de overshoot para ζ 0,6 ≈ 0,095; margem para discretização.
    expect(Math.abs(minAfterPeak)).toBeLessThan(0.15 * peak);
    expect(Math.abs(s.value)).toBeLessThan(1e-2);
  });

  it('segue um alvo diferente de zero e reset zera tudo', () => {
    const s = new Spring(1, 20);
    s.target = 0.5;
    for (let i = 0; i < 120; i++) s.step(DT);
    expect(s.value).toBeCloseTo(0.5, 3);
    s.reset();
    expect(s.value).toBe(0);
    expect(s.velocity).toBe(0);
    expect(s.target).toBe(0);
  });
});
