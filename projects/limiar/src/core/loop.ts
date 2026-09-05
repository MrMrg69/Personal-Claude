import { FIXED_DT, MAX_FRAME_DT, MAX_STEPS_PER_FRAME } from './time';

export interface LoopCallbacks {
  /** 0..N vezes por frame, sempre com o mesmo dt. */
  fixedUpdate(dt: number): void;
  /** 1x por frame; alpha ∈ [0,1] é a fração do passo fixo decorrida (interpolação). */
  frameUpdate(dt: number, alpha: number): void;
  render(): void;
}

export interface LoopStats {
  stepsLastFrame: number;
  frameDt: number;
  /** Tempo simulado acumulado (s). */
  simTime: number;
  /** Frames em que o teto de passos foi atingido e tempo foi descartado. */
  droppedSteps: number;
}

/**
 * Timestep fixo com interpolação (design §4.2). O relógio vem de fora
 * (timestamp do setAnimationLoop ≡ performance.now()), o que torna o loop
 * testável em Node chamando tick() com valores arbitrários.
 */
export class GameLoop {
  readonly stats: LoopStats = { stepsLastFrame: 0, frameDt: 0, simTime: 0, droppedSteps: 0 };

  private acc = 0;
  /** null = próximo tick é o primeiro depois de start/resume (frameDt = 0). */
  private lastMs: number | null = null;
  private isPaused = false;

  constructor(
    private readonly cb: LoopCallbacks,
    private readonly fixedDt: number = FIXED_DT,
  ) {}

  get paused(): boolean {
    return this.isPaused;
  }

  tick(nowMs: number): void {
    const frameDt = this.lastMs === null ? 0 : Math.min((nowMs - this.lastMs) / 1000, MAX_FRAME_DT);
    this.lastMs = nowMs;
    this.stats.frameDt = frameDt;

    if (!this.isPaused) {
      this.acc += frameDt;
      let steps = 0;
      while (this.acc >= this.fixedDt && steps < MAX_STEPS_PER_FRAME) {
        this.cb.fixedUpdate(this.fixedDt);
        this.acc -= this.fixedDt;
        this.stats.simTime += this.fixedDt;
        steps++;
      }
      // Teto atingido: descarta o resto em vez de entrar na espiral da morte.
      if (this.acc >= this.fixedDt) {
        this.stats.droppedSteps++;
        this.acc = 0;
      }
      this.stats.stepsLastFrame = steps;
    } else {
      this.stats.stepsLastFrame = 0;
    }

    // Pausado: alpha = 1 mostra o último estado simulado, sem "voltar no tempo".
    this.cb.frameUpdate(frameDt, this.isPaused ? 1 : this.acc / this.fixedDt);
    this.cb.render();
  }

  /** Congela a simulação; o render continua (overlay sobre a cena parada). */
  pause(): void {
    this.isPaused = true;
  }

  /** Zera acumulador e relógio: não integra o tempo passado em pausa. */
  resume(): void {
    this.isPaused = false;
    this.acc = 0;
    this.lastMs = null;
  }
}
