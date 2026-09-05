import { describe, expect, it } from 'vitest';
import { GameLoop, type LoopCallbacks } from '@/core/loop';
import { MAX_FRAME_DT, MAX_STEPS_PER_FRAME } from '@/core/time';

/** dt fixo de 10 ms nos testes: evita ambiguidade de ponto flutuante com 1/60. */
const DT = 0.01;

function makeLoop() {
  const calls = { fixed: 0, frames: 0, renders: 0, alphas: [] as number[] };
  const cb: LoopCallbacks = {
    fixedUpdate: () => calls.fixed++,
    frameUpdate: (_dt, alpha) => {
      calls.frames++;
      calls.alphas.push(alpha);
    },
    render: () => calls.renders++,
  };
  return { loop: new GameLoop(cb, DT), calls };
}

describe('GameLoop', () => {
  it('primeiro tick não integra (frameDt = 0) e cada tick renderiza uma vez', () => {
    const { loop, calls } = makeLoop();
    loop.tick(1000);
    expect(calls.fixed).toBe(0);
    expect(calls.frames).toBe(1);
    expect(calls.renders).toBe(1);
  });

  it('executa floor(frameDt / dt) passos e guarda o resto no alpha', () => {
    const { loop, calls } = makeLoop();
    loop.tick(0);
    loop.tick(45);
    expect(calls.fixed).toBe(4);
    expect(loop.stats.stepsLastFrame).toBe(4);
    expect(calls.alphas[1]).toBeCloseTo(0.5, 6);
    expect(loop.stats.simTime).toBeCloseTo(0.04, 9);
  });

  it('clampa o frame em MAX_FRAME_DT, limita a MAX_STEPS_PER_FRAME e descarta o resto', () => {
    const { loop, calls } = makeLoop();
    loop.tick(0);
    loop.tick(5000);
    expect(loop.stats.frameDt).toBe(MAX_FRAME_DT);
    expect(calls.fixed).toBe(MAX_STEPS_PER_FRAME);
    expect(loop.stats.droppedSteps).toBe(1);
    // Acumulador zerado: o próximo frame de 10 ms dá exatamente 1 passo.
    loop.tick(5010);
    expect(calls.fixed).toBe(MAX_STEPS_PER_FRAME + 1);
  });

  it('alpha fica sempre em [0, 1]', () => {
    const { loop, calls } = makeLoop();
    let t = 0;
    for (let i = 0; i < 200; i++) {
      t += 3 + ((i * 7) % 23);
      loop.tick(t);
    }
    for (const a of calls.alphas) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it('pausa congela a simulação (render continua, alpha = 1) e resume zera o acumulador', () => {
    const { loop, calls } = makeLoop();
    loop.tick(0);
    loop.tick(5);
    expect(calls.fixed).toBe(0);
    loop.pause();
    expect(loop.paused).toBe(true);
    loop.tick(3000);
    expect(calls.fixed).toBe(0);
    expect(calls.renders).toBe(3);
    expect(calls.alphas[2]).toBe(1);
    loop.resume();
    expect(loop.paused).toBe(false);
    // Primeiro tick pós-resume não integra o tempo pausado.
    loop.tick(6000);
    expect(calls.fixed).toBe(0);
    loop.tick(6010);
    expect(calls.fixed).toBe(1);
  });
});
