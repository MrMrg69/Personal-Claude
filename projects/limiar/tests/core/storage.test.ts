import { describe, expect, it } from 'vitest';
import { SaveStore, type SaveEnvelope } from '@/core/storage';
import { FakeStorage } from '../helpers/fake-storage';

interface SettingsV3 {
  sensitivity: number;
  hfov: number;
}

function isSettingsV3(p: unknown): p is SettingsV3 {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as SettingsV3).sensitivity === 'number' &&
    typeof (p as SettingsV3).hfov === 'number'
  );
}

/** v1 → v2: renomeia `sens`; v2 → v3: adiciona `hfov`. */
const migrations = [
  (old: unknown) => {
    const o = old as { sens: number };
    return { sensitivity: o.sens };
  },
  (old: unknown) => ({ ...(old as { sensitivity: number }), hfov: 95 }),
];

function makeStore(storage: FakeStorage) {
  return new SaveStore<SettingsV3>({
    key: 'limiar.test',
    version: 3,
    migrations,
    validate: isSettingsV3,
    storage,
    now: () => 1700000000000,
  });
}

describe('SaveStore', () => {
  it('save grava envelope { version, savedAt, payload } e load devolve o payload', () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    store.save({ sensitivity: 1.5, hfov: 95 });
    const env = JSON.parse(storage.getItem('limiar.test') ?? '') as SaveEnvelope;
    expect(env.version).toBe(3);
    expect(env.savedAt).toBe(1700000000000);
    expect(store.load()).toEqual({ sensitivity: 1.5, hfov: 95 });
  });

  it('aplica migrations em sequência a partir da versão salva', () => {
    const storage = new FakeStorage();
    storage.setItem('limiar.test', JSON.stringify({ version: 1, savedAt: 0, payload: { sens: 2 } }));
    expect(makeStore(storage).load()).toEqual({ sensitivity: 2, hfov: 95 });

    storage.setItem('limiar.test', JSON.stringify({ version: 2, savedAt: 0, payload: { sensitivity: 0.8 } }));
    expect(makeStore(storage).load()).toEqual({ sensitivity: 0.8, hfov: 95 });
  });

  it('devolve null para ausência, JSON inválido, envelope malformado, versão futura ou payload inválido', () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    expect(store.load()).toBeNull();
    storage.setItem('limiar.test', '{not json');
    expect(store.load()).toBeNull();
    storage.setItem('limiar.test', JSON.stringify({ foo: 1 }));
    expect(store.load()).toBeNull();
    storage.setItem('limiar.test', JSON.stringify({ version: 4, savedAt: 0, payload: {} }));
    expect(store.load()).toBeNull();
    storage.setItem('limiar.test', JSON.stringify({ version: 3, savedAt: 0, payload: { sensitivity: 'x' } }));
    expect(store.load()).toBeNull();
  });

  it('clear remove a chave e a contagem de migrations é validada', () => {
    const storage = new FakeStorage();
    const store = makeStore(storage);
    store.save({ sensitivity: 1, hfov: 90 });
    store.clear();
    expect(storage.getItem('limiar.test')).toBeNull();
    expect(
      () => new SaveStore<SettingsV3>({ key: 'k', version: 3, migrations: [], validate: isSettingsV3, storage }),
    ).toThrow(/migrations/);
  });
});
