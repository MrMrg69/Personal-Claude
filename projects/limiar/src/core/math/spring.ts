/**
 * Mola amortecida (design §3.6): integração semi-implícita, estável para
 * ω·h ≤ 0,5 — step() sub-divide dt para garantir isso em qualquer frame rate. Usada pelo kick de pouso e
 * pelo slot de recoil: kick() dá um impulso de velocidade e a mola volta a
 * `target` sozinha — offsets nunca acumulam.
 */
/** Limite de ω·h por sub-passo para a integração semi-implícita ficar estável. */
const MAX_OMEGA_DT = 0.5;

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
   * Avança `dt` segundos. Sub-divide internamente para manter ω·h ≤ MAX_OMEGA_DT:
   * um frame de 0,1 s (hitch, aba lenta) com ω = 26 daria ω·dt = 2,6 e a
   * integração explodiria para ±Infinity/NaN — e a câmera sumiria.
   */
  step(dt: number): number {
    if (dt <= 0) return this.value;
    const n = Math.max(1, Math.ceil((this.omega * dt) / MAX_OMEGA_DT));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const accel = -2 * this.zeta * this.omega * this.velocity - this.omega * this.omega * (this.value - this.target);
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.velocity = 0;
    this.target = 0;
  }
}
