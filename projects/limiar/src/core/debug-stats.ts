import type * as THREE from 'three';

/** Janela de acumulação de frame time (design §8.1: avg/max de 1 s; a média longa é configurável). */
const WINDOW_SEC = 1;

export interface DebugStatsOptions {
  /** performance.mark/measure por frame (ligado em DEV). */
  marks: boolean;
  /** s. Janela da média longa (frameAvg3sMs); o auto-desligar de sombras usa SHADOW_AUTO_OFF.windowSec. */
  longWindowSec: number;
}

export interface DebugStatsSnapshot {
  fps: number;
  frameAvgMs: number;
  frameMaxMs: number;
  frameAvg3sMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

/**
 * Estatísticas de frame e do renderer. Sem alocação por frame; snapshot()
 * aloca (só sob demanda, ex.: e2e). performance.mark/measure são opcionais
 * (ligados em DEV) para leitura no painel Performance do navegador.
 */
export class DebugStats {
  fps = 0;
  frameAvgMs = 0;
  frameMaxMs = 0;
  frameAvg3sMs = 0;
  drawCalls = 0;
  triangles = 0;
  geometries = 0;
  textures = 0;
  programs = 0;

  private winTime = 0;
  private winCount = 0;
  private winSum = 0;
  private winMax = 0;
  /** Quantas janelas de WINDOW_SEC compõem a média longa (≥ 1). */
  private readonly longWindows: number;
  private readonly longSums: Float64Array;
  private readonly longCounts: Float64Array;
  private longIdx = 0;
  private readonly marksEnabled: boolean;

  constructor(opts: DebugStatsOptions) {
    this.marksEnabled = opts.marks && typeof performance !== 'undefined' && typeof performance.mark === 'function';
    this.longWindows = Math.max(1, Math.round(opts.longWindowSec / WINDOW_SEC));
    this.longSums = new Float64Array(this.longWindows);
    this.longCounts = new Float64Array(this.longWindows);
  }

  /** Uma vez por frame com o dt do frame (s). */
  recordFrame(frameDt: number): void {
    const ms = frameDt * 1000;
    this.winTime += frameDt;
    this.winCount++;
    this.winSum += ms;
    if (ms > this.winMax) this.winMax = ms;
    if (this.winTime < WINDOW_SEC) return;

    this.fps = this.winCount / this.winTime;
    this.frameAvgMs = this.winSum / this.winCount;
    this.frameMaxMs = this.winMax;

    this.longSums[this.longIdx] = this.winSum;
    this.longCounts[this.longIdx] = this.winCount;
    this.longIdx = (this.longIdx + 1) % this.longWindows;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < this.longWindows; i++) {
      sum += this.longSums[i] ?? 0;
      count += this.longCounts[i] ?? 0;
    }
    this.frameAvg3sMs = count > 0 ? sum / count : 0;

    // Limpa 1×/s: sem isto a timeline acumula ~540 entradas/s em DEV (6 marks + 3 measures por frame).
    if (this.marksEnabled) {
      performance.clearMarks();
      performance.clearMeasures();
    }

    this.winTime = 0;
    this.winCount = 0;
    this.winSum = 0;
    this.winMax = 0;
  }

  /** Lê renderer.info (chamar após o render do frame anterior). */
  readRenderer(info: THREE.WebGLRenderer['info']): void {
    this.drawCalls = info.render.calls;
    this.triangles = info.render.triangles;
    this.geometries = info.memory.geometries;
    this.textures = info.memory.textures;
    this.programs = info.programs?.length ?? 0;
  }

  mark(name: string): void {
    if (this.marksEnabled) performance.mark(name);
  }

  measure(name: string, startMark: string, endMark: string): void {
    if (!this.marksEnabled) return;
    try {
      performance.measure(name, startMark, endMark);
    } catch {
      // Marca ausente (ex.: primeiro frame): ignorar é mais barato que checar.
    }
  }

  snapshot(): DebugStatsSnapshot {
    return {
      fps: this.fps,
      frameAvgMs: this.frameAvgMs,
      frameMaxMs: this.frameMaxMs,
      frameAvg3sMs: this.frameAvg3sMs,
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      geometries: this.geometries,
      textures: this.textures,
      programs: this.programs,
    };
  }
}
