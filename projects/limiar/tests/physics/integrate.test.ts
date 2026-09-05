import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Transform } from '@/core/entity';
import {
  createCapsuleBody,
  createMoveIntent,
  integrateCapsuleBody,
  jumpSpeedFor,
  type CapsuleBody,
  type MoveIntent,
} from '@/core/physics/capsule-body';
import { CollisionLayer } from '@/core/physics/layers';
import { FIXED_DT } from '@/core/time';
import { MOVEMENT } from '@/data/movement-config';

interface Sim {
  t: Transform;
  body: CapsuleBody;
  intent: MoveIntent;
  out: { jumped: boolean };
}

function makeSim(grounded = true): Sim {
  const body = createCapsuleBody(MOVEMENT, CollisionLayer.Player, CollisionLayer.World);
  body.grounded = grounded;
  return {
    t: { position: new THREE.Vector3(), prevPosition: new THREE.Vector3(), yaw: 0 },
    body,
    intent: createMoveIntent(),
    out: { jumped: false },
  };
}

function step(s: Sim, n = 1): void {
  for (let i = 0; i < n; i++) {
    integrateCapsuleBody(s.t, s.body, s.intent, MOVEMENT, FIXED_DT, s.out);
    s.intent.jumpPressed = false;
    // Sem colisão nos testes puros: "chão" = y ≤ 0 enquanto não pulou.
    if (!s.body.airborneByJump && s.t.position.y <= 0) {
      s.t.position.y = 0;
      s.body.velocity.y = 0;
      s.body.grounded = true;
    }
  }
}

/**
 * Salta segurando o pulo nos primeiros `holdSteps` passos (o keydown que gera
 * jumpPressed também liga jumpHeld: no navegador o hold nunca é 0 passos) e
 * devolve a altura máxima atingida (m).
 */
function jumpApex(holdSteps: number): number {
  const s = makeSim();
  s.intent.jumpPressed = true;
  let apex = 0;
  for (let i = 0; i < 240; i++) {
    s.intent.jumpHeld = i < holdSteps;
    step(s);
    apex = Math.max(apex, s.t.position.y);
    if (s.body.velocity.y < 0) break;
  }
  return apex;
}

function horizontalSpeed(s: Sim): number {
  return Math.hypot(s.body.velocity.x, s.body.velocity.z);
}

describe('integrateCapsuleBody', () => {
  it('jumpSpeed = √(2·|g|·h) + |g|·dt/2 ≈ 8,40 m/s', () => {
    expect(jumpSpeedFor(MOVEMENT, FIXED_DT)).toBeCloseTo(8.4, 1);
  });

  it('toque (≤ 4 passos = 67 ms) sobe 1,40 ± 0,03 m', () => {
    for (const holdSteps of [0, 4]) {
      const apex = jumpApex(holdSteps);
      expect(apex, `hold ${holdSteps} passos`).toBeGreaterThan(1.37);
      expect(apex, `hold ${holdSteps} passos`).toBeLessThan(1.43);
    }
  });

  it('toque de 133 ms (8 passos) fica abaixo de 1,7 m', () => {
    expect(jumpApex(8)).toBeLessThan(1.7);
  });

  it('segurado (≥ 30 passos) sobe entre 2,0 e 2,4 m', () => {
    const apex = jumpApex(30);
    expect(apex).toBeGreaterThanOrEqual(2.0);
    expect(apex).toBeLessThanOrEqual(2.4);
  });

  it('yaw = 0: frente é −Z e direita é +X', () => {
    const s = makeSim();
    s.intent.dir.set(0, 1);
    step(s, 60);
    expect(s.t.position.z).toBeLessThan(-1);
    expect(Math.abs(s.t.position.x)).toBeLessThan(1e-9);
    const r = makeSim();
    r.intent.dir.set(1, 0);
    step(r, 60);
    expect(r.t.position.x).toBeGreaterThan(1);
  });

  it('andar atinge walkSpeed e sprint só vale empurrando para a frente', () => {
    const s = makeSim();
    s.intent.dir.set(0, 1);
    step(s, 60);
    expect(horizontalSpeed(s)).toBeCloseTo(MOVEMENT.walkSpeed, 6);

    s.intent.sprint = true;
    step(s, 60);
    expect(horizontalSpeed(s)).toBeCloseTo(MOVEMENT.sprintSpeed, 6);

    s.intent.dir.set(1, 0);
    step(s, 60);
    expect(horizontalSpeed(s)).toBeCloseTo(MOVEMENT.walkSpeed, 6);
  });

  it('diagonal não é mais rápida que andar reto', () => {
    const s = makeSim();
    s.intent.dir.set(1, 1);
    step(s, 60);
    expect(horizontalSpeed(s)).toBeCloseTo(MOVEMENT.walkSpeed, 6);
  });

  it('sem input no chão, para em menos de 0,1 s', () => {
    const s = makeSim();
    s.intent.dir.set(0, 1);
    step(s, 60);
    s.intent.dir.set(0, 0);
    let steps = 0;
    while (horizontalSpeed(s) > 0 && steps < 60) {
      step(s);
      steps++;
    }
    expect(horizontalSpeed(s)).toBe(0);
    expect(steps * FIXED_DT).toBeLessThan(0.1);
  });

  it('controle aéreo não excede airMaxSpeed e sem input não há atrito aéreo', () => {
    const s = makeSim(false);
    s.t.position.y = 1000;
    s.intent.dir.set(0, 1);
    s.intent.sprint = true;
    step(s, 120);
    expect(horizontalSpeed(s)).toBeLessThanOrEqual(MOVEMENT.airMaxSpeed + 1e-9);
    expect(horizontalSpeed(s)).toBeGreaterThan(MOVEMENT.airMaxSpeed - 1e-6);

    s.intent.dir.set(0, 0);
    const before = horizontalSpeed(s);
    step(s, 30);
    expect(horizontalSpeed(s)).toBeCloseTo(before, 9);
  });

  it('sprint-jump segurando W preserva 8,5 m/s no ar', () => {
    const s = makeSim();
    s.intent.dir.set(0, 1);
    s.intent.sprint = true;
    step(s, 60);
    expect(horizontalSpeed(s)).toBeCloseTo(MOVEMENT.sprintSpeed, 6);
    s.intent.jumpPressed = true;
    for (let i = 0; i < 40; i++) {
      step(s);
      expect(horizontalSpeed(s)).toBeCloseTo(MOVEMENT.sprintSpeed, 6);
    }
    expect(s.body.grounded).toBe(false);
  });

  it('pulo andando + strafe não passa de airMaxSpeed', () => {
    const s = makeSim();
    s.intent.dir.set(0, 1);
    step(s, 60);
    s.intent.jumpPressed = true;
    s.intent.dir.set(1, 1);
    let max = 0;
    for (let i = 0; i < 40; i++) {
      step(s);
      max = Math.max(max, horizontalSpeed(s));
    }
    expect(max).toBeLessThanOrEqual(MOVEMENT.airMaxSpeed + 1e-9);
    expect(s.body.velocity.x).toBeGreaterThan(0);
  });

  it('sprint-jump + S freia', () => {
    const s = makeSim();
    s.intent.dir.set(0, 1);
    s.intent.sprint = true;
    step(s, 60);
    s.intent.jumpPressed = true;
    s.intent.sprint = false;
    s.intent.dir.set(0, -1);
    step(s, 30);
    expect(horizontalSpeed(s)).toBeLessThan(MOVEMENT.sprintSpeed);
  });

  it('queda é limitada por maxFallSpeed', () => {
    const s = makeSim(false);
    s.t.position.y = 1000;
    step(s, 600);
    expect(s.body.velocity.y).toBe(MOVEMENT.maxFallSpeed);
  });

  it('coyote time: pula até 0,1 s depois de sair do chão, não depois', () => {
    const early = makeSim(false);
    early.t.position.y = 5;
    step(early, 3); // 0,05 s no ar
    early.intent.jumpPressed = true;
    step(early);
    expect(early.out.jumped).toBe(true);

    const late = makeSim(false);
    late.t.position.y = 5;
    step(late, 8); // 0,133 s no ar
    late.intent.jumpPressed = true;
    step(late);
    expect(late.out.jumped).toBe(false);
  });

  it('coyote não dá pulo duplo depois de já ter pulado', () => {
    const s = makeSim();
    s.intent.jumpPressed = true;
    step(s);
    expect(s.out.jumped).toBe(true);
    step(s, 2);
    s.intent.jumpPressed = true;
    step(s);
    expect(s.out.jumped).toBe(false);
  });

  it('jump buffer: pressionar até 0,1 s antes de tocar o chão pula ao pousar', () => {
    const s = makeSim(false);
    s.t.position.y = 5;
    s.body.velocity.y = -10;
    s.body.timeSinceGrounded = 1; // caindo há tempo: sem coyote
    s.intent.jumpPressed = true;
    step(s, 3); // 0,05 s depois ainda no ar
    expect(s.out.jumped).toBe(false);
    s.body.grounded = true;
    s.t.position.y = 0;
    step(s);
    expect(s.out.jumped).toBe(true);

    const expired = makeSim(false);
    expired.t.position.y = 5;
    expired.body.timeSinceGrounded = 1;
    expired.intent.jumpPressed = true;
    step(expired, 8); // 0,133 s
    expired.body.grounded = true;
    step(expired);
    expect(expired.out.jumped).toBe(false);
  });

  it('guarda prevPosition para interpolação', () => {
    const s = makeSim();
    s.intent.dir.set(0, 1);
    step(s, 10);
    const before = s.t.position.clone();
    step(s);
    expect(s.t.prevPosition.equals(before)).toBe(true);
  });
});
