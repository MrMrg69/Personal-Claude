import { describe, expect, it } from 'vitest';
import { EventBus } from '@/core/events';

interface TestEvents {
  ping: { n: number };
  died: { id: number };
}

describe('EventBus', () => {
  it('on/emit entrega síncrono e unsubscribe para de entregar', () => {
    const bus = new EventBus<TestEvents>();
    const got: number[] = [];
    const off = bus.on('ping', (p) => got.push(p.n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(got).toEqual([1]);
  });

  it('once dispara uma única vez', () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    bus.once('ping', () => count++);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(count).toBe(1);
  });

  it('queue só entrega em flush, inclusive o que for enfileirado durante o flush', () => {
    const bus = new EventBus<TestEvents>();
    const got: string[] = [];
    bus.on('died', (p) => {
      got.push(`died ${p.id}`);
      if (p.id === 1) bus.queue('ping', { n: 99 });
    });
    bus.on('ping', (p) => got.push(`ping ${p.n}`));
    bus.queue('died', { id: 1 });
    expect(got).toEqual([]);
    bus.flush();
    expect(got).toEqual(['died 1', 'ping 99']);
    bus.flush();
    expect(got).toHaveLength(2);
  });

  it('unsubscribe durante o emit é seguro e os outros handlers continuam recebendo', () => {
    const bus = new EventBus<TestEvents>();
    const got: string[] = [];
    const offA = bus.on('ping', () => {
      got.push('a');
      offA();
      offB();
    });
    const offB = bus.on('ping', () => got.push('b'));
    bus.on('ping', () => got.push('c'));
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(got).toEqual(['a', 'c', 'c']);
  });

  it('emit dentro de handler é permitido, mas recursão infinita lança em vez de travar', () => {
    const bus = new EventBus<TestEvents>();
    let depth = 0;
    bus.on('ping', (p) => {
      depth = Math.max(depth, p.n);
      if (p.n < 3) bus.emit('ping', { n: p.n + 1 });
    });
    bus.emit('ping', { n: 1 });
    expect(depth).toBe(3);

    let calls = 0;
    bus.on('died', (p) => {
      calls++;
      bus.emit('died', p);
    });
    expect(() => bus.emit('died', { id: 1 })).toThrow(/recursão/);
    expect(calls).toBeLessThan(100);
  });

  it('clear remove handlers e fila', () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    bus.on('ping', () => count++);
    bus.queue('ping', { n: 1 });
    bus.clear();
    bus.flush();
    bus.emit('ping', { n: 2 });
    expect(count).toBe(0);
  });
});
