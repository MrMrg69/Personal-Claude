import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { InputState, isEditableTarget, type InputBindings } from '@/core/input';

const BINDINGS: InputBindings = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  Mouse0: 'fire',
  Wheel: 'swapWeapon',
};

describe('InputState', () => {
  it('borda sobrevive a frames sem passo e é consumida por um passo', () => {
    const input = new InputState(BINDINGS);
    input.onKeyCode('Space', true);
    // Dois "frames" sem passo fixo: nada chama endFixedStep.
    expect(input.justPressed('jump')).toBe(true);
    expect(input.justPressed('jump')).toBe(true);
    // Primeiro passo consome a borda…
    expect(input.justPressed('jump')).toBe(true);
    input.endFixedStep();
    // …o segundo não a vê mais, mas a tecla continua pressionada.
    expect(input.justPressed('jump')).toBe(false);
    expect(input.isDown('jump')).toBe(true);
    input.onKeyCode('Space', false);
    expect(input.justReleased('jump')).toBe(true);
    input.endFixedStep();
    expect(input.justReleased('jump')).toBe(false);
    expect(input.isDown('jump')).toBe(false);
  });

  it('isEditableTarget: campos de formulário e contentEditable; null não', () => {
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: false } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('códigos não mapeados são ignorados (sem preventDefault)', () => {
    const input = new InputState(BINDINGS);
    expect(input.onKeyCode('F5', true)).toBe(false);
    expect(input.onKeyCode('KeyW', true)).toBe(true);
  });

  it('reset solta tudo sem gerar bordas', () => {
    const input = new InputState(BINDINGS);
    input.onKeyCode('KeyW', true);
    input.endFixedStep();
    input.onMouseMove(10, -4);
    input.reset();
    expect(input.isDown('forward')).toBe(false);
    expect(input.justReleased('forward')).toBe(false);
    const d = input.consumeMouseDelta(new THREE.Vector2());
    expect(d.x).toBe(0);
    expect(d.y).toBe(0);
  });

  it('inject segura ações até o próximo inject e gera bordas', () => {
    const input = new InputState(BINDINGS);
    input.inject({ forward: true }, [12, 3]);
    expect(input.isDown('forward')).toBe(true);
    expect(input.justPressed('forward')).toBe(true);
    input.endFixedStep();
    input.endFixedStep();
    expect(input.isDown('forward')).toBe(true);
    const d = input.consumeMouseDelta(new THREE.Vector2());
    expect(d.x).toBe(12);
    expect(d.y).toBe(3);
    input.inject({});
    expect(input.isDown('forward')).toBe(false);
    expect(input.justReleased('forward')).toBe(true);
  });

  it('teclado físico e sintético somam sem borda dupla', () => {
    const input = new InputState(BINDINGS);
    input.onKeyCode('KeyW', true);
    input.endFixedStep();
    input.inject({ forward: true });
    expect(input.justPressed('forward')).toBe(false);
    input.onKeyCode('KeyW', false);
    // Ainda segurado pelo modo sintético: sem released.
    expect(input.isDown('forward')).toBe(true);
    expect(input.justReleased('forward')).toBe(false);
  });

  it('moveAxis normaliza a diagonal e consumeMouseDelta zera o acumulado', () => {
    const input = new InputState(BINDINGS);
    input.onKeyCode('KeyW', true);
    input.onKeyCode('KeyD', true);
    const axis = input.moveAxis(new THREE.Vector2());
    expect(axis.length()).toBeCloseTo(1, 9);
    expect(axis.x).toBeGreaterThan(0);
    expect(axis.y).toBeGreaterThan(0);

    input.onMouseMove(5, 5);
    input.onMouseMove(-2, 1);
    const out = new THREE.Vector2();
    input.consumeMouseDelta(out);
    expect(out.x).toBe(3);
    expect(out.y).toBe(6);
    input.consumeMouseDelta(out);
    expect(out.x).toBe(0);
  });

  it('botão do mouse mapeia Mouse<n> e a roda é um pulso', () => {
    const input = new InputState(BINDINGS);
    expect(input.onMouseButton(0, true)).toBe(true);
    expect(input.isDown('fire')).toBe(true);
    expect(input.onMouseButton(1, true)).toBe(false);

    expect(input.onWheel()).toBe(true);
    expect(input.justPressed('swapWeapon')).toBe(true);
    expect(input.justReleased('swapWeapon')).toBe(true);
    expect(input.isDown('swapWeapon')).toBe(false);
    input.endFixedStep();
    expect(input.justPressed('swapWeapon')).toBe(false);
  });
});
