/** Feel de câmera em M0 (design §5.5): kick de pouso, slot de recoil, head-bob desligado. */
export interface FeelConfig {
  landKick: {
    /** Pitch máximo do kick (graus), atingido com fallSpeed ≥ fallSpeedRef. */
    pitchDeg: number;
    /** Afundamento máximo da cabeça (m). */
    posY: number;
    /** m/s de queda que produz amplitude 1 (amp = clamp(fallSpeed / fallSpeedRef, 0, 1)). */
    fallSpeedRef: number;
    /** Mola: amortecimento e frequência (rad/s). */
    zeta: number;
    omega: number;
  };
  recoil: {
    zeta: number;
    omega: number;
    /** Velocidade de retorno do offset de recoil (graus/s). */
    recoveryDegPerSec: number;
    /** Kick sintético de F9 (evento camera:kick) para afinar a mola antes de existir arma. */
    debugKick: { pitchDeg: number; yawDeg: number; posBack: number };
  };
  headBob: {
    /** Desligado por padrão (acessibilidade e escopo de M0); toggle no painel. */
    enabled: boolean;
    ampY: number;
    ampX: number;
    rollDeg: number;
    hz: number;
  };
}

export const FEEL: FeelConfig = {
  landKick: { pitchDeg: 2.5, posY: 0.06, fallSpeedRef: 20, zeta: 0.6, omega: 22 },
  recoil: {
    zeta: 0.55,
    omega: 26,
    recoveryDegPerSec: 18,
    debugKick: { pitchDeg: 1.2, yawDeg: 0.3, posBack: 0.02 },
  },
  headBob: { enabled: false, ampY: 0.018, ampX: 0.01, rollDeg: 0.25, hz: 1.9 },
};

// HMR: copia por sub-objeto para não trocar as referências aninhadas (painel lil-gui liga nelas).
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    const next: FeelConfig | undefined = mod?.FEEL;
    if (!next) return;
    Object.assign(FEEL.landKick, next.landKick);
    Object.assign(FEEL.recoil, next.recoil);
    Object.assign(FEEL.recoil.debugKick, next.recoil.debugKick);
    Object.assign(FEEL.headBob, next.headBob);
  });
}
