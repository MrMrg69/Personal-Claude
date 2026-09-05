import { keepLive } from './hot-config';

/** Feel de câmera em M0 (design §5.5): kick de pouso, slot de recoil, head-bob desligado. */
export interface FeelConfig {
  landKick: {
    /** Pico de pitch do kick (graus) com fallSpeed ≥ fallSpeedRef (impulso via Spring.kickToPeak). */
    pitchDeg: number;
    /** Pico de afundamento da cabeça (m). */
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

/** Copia por sub-objeto: não troca as referências aninhadas (o painel lil-gui liga nelas). */
function assignFeel(live: FeelConfig, fresh: FeelConfig): void {
  Object.assign(live.landKick, fresh.landKick);
  Object.assign(live.recoil, fresh.recoil);
  Object.assign(live.recoil.debugKick, fresh.recoil.debugKick);
  Object.assign(live.headBob, fresh.headBob);
}

const DEFAULTS: FeelConfig = {
  landKick: { pitchDeg: 2.5, posY: 0.06, fallSpeedRef: 20, zeta: 0.6, omega: 22 },
  recoil: {
    zeta: 0.55,
    omega: 26,
    recoveryDegPerSec: 18,
    debugKick: { pitchDeg: 1.2, yawDeg: 0.3, posBack: 0.02 },
  },
  headBob: { enabled: false, ampY: 0.018, ampX: 0.01, rollDeg: 0.25, hz: 1.9 },
};

/** Objeto MUTÁVEL (HMR/painel); keepLive mantém a referência entre edições. */
export const FEEL: FeelConfig = keepLive(import.meta.hot, 'feel', DEFAULTS, assignFeel);

if (import.meta.hot) import.meta.hot.accept();
