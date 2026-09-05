/**
 * Mola amortecida (design §3.6) integrada de forma EXATA: cada step() aplica a
 * solução analítica do oscilador amortecido ao par (value − target, velocity),
 * então o resultado não depende do frame rate nem diverge com dt grande (um
 * hitch de 0,1 s com ω = 26 só avança a mola para onde ela estaria). Usada
 * pelo kick de pouso e pelo slot de recoil: kick()/kickToPeak() dão um impulso
 * de velocidade e a mola volta a `target` sozinha — offsets nunca acumulam.
 *
 * Por que exata e não Euler semi-implícito: a resposta ao impulso de ζ 0,6 /
 * ω 22 atinge o pico em ~50 ms; com Euler a 60 Hz (ω·h = 0,37) o pico saía
 * 40 % menor que a 144 Hz — o "feel" mudava com a máquina.
 */

/** Abaixo disto |ζ − 1| é tratado como amortecimento crítico (evita dividir por ω·√|1−ζ²| ≈ 0). */
const CRITICAL_EPSILON = 1e-4;

export class Spring {
  value = 0;
  velocity = 0;
  target = 0;

  /**
   * @param zeta  fator de amortecimento (1 = crítico; 0,6 = leve overshoot)
   * @param omega frequência angular (rad/s); maior = mais rápida
   */
  constructor(
    public zeta: number,
    public omega: number,
  ) {}

  kick(deltaVelocity: number): void {
    this.velocity += deltaVelocity;
  }

  /**
   * Impulso calibrado para o deslocamento máximo ≈ `peak` (mesmo sinal), a
   * partir do repouso: a resposta ao impulso atinge só peakFactor(ζ)·v0/ω, e
   * `kick(peak·ω)` daria metade do pico anunciado em ζ = 0,6.
   */
  kickToPeak(peak: number): void {
    this.kick((peak * this.omega) / Spring.peakFactor(this.zeta));
  }

  /**
   * Pico da resposta ao impulso unitário normalizado por v0/ω:
   * ζ < 1 → exp(−ζ/√(1−ζ²) · atan(√(1−ζ²)/ζ)); ζ = 1 → e⁻¹ (x = v0·t·e^(−ωt));
   * ζ > 1 → exp(−ζ/√(ζ²−1) · atanh(√(ζ²−1)/ζ)) (mesma forma com funções hiperbólicas).
   */
  static peakFactor(zeta: number): number {
    if (Math.abs(zeta - 1) < CRITICAL_EPSILON) return Math.exp(-1);
    if (zeta < 1) {
      const root = Math.sqrt(1 - zeta * zeta);
      return Math.exp((-zeta / root) * Math.atan(root / zeta));
    }
    const root = Math.sqrt(zeta * zeta - 1);
    return Math.exp((-zeta / root) * Math.atanh(root / zeta));
  }

  /**
   * Avança `dt` segundos com a solução fechada (target constante durante o
   * passo). y = value − target; a = ζω. Sub-amortecida: e^(−at)·[y0·cos(ω_d t)
   * + (v0 + a·y0)/ω_d · sin(ω_d t)]; crítica: e^(−ωt)·[y0 + (v0 + ω·y0)·t];
   * super-amortecida: idem à sub-amortecida com cosh/sinh e ω_h = ω√(ζ²−1).
   */
  step(dt: number): number {
    if (dt <= 0) return this.value;
    const w = this.omega;
    const zeta = this.zeta;
    const y0 = this.value - this.target;
    const v0 = this.velocity;
    const a = zeta * w;
    const decay = Math.exp(-a * dt);
    let y: number;
    let v: number;

    if (Math.abs(zeta - 1) < CRITICAL_EPSILON) {
      const c = v0 + w * y0;
      y = decay * (y0 + c * dt);
      v = decay * (v0 - w * c * dt);
    } else if (zeta < 1) {
      const wd = w * Math.sqrt(1 - zeta * zeta);
      const cos = Math.cos(wd * dt);
      const sin = Math.sin(wd * dt);
      y = decay * (y0 * cos + ((v0 + a * y0) / wd) * sin);
      v = decay * (v0 * cos - ((a * v0 + w * w * y0) / wd) * sin);
    } else {
      const wh = w * Math.sqrt(zeta * zeta - 1);
      const cosh = Math.cosh(wh * dt);
      const sinh = Math.sinh(wh * dt);
      y = decay * (y0 * cosh + ((v0 + a * y0) / wh) * sinh);
      v = decay * (v0 * cosh - ((a * v0 + w * w * y0) / wh) * sinh);
    }

    this.value = this.target + y;
    this.velocity = v;
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.velocity = 0;
    this.target = 0;
  }
}
