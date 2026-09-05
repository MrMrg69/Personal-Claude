/**
 * Persistência versionada em localStorage (design §3.6). Envelope
 * { version, savedAt, payload }; `migrations[v - 1]` converte um payload da
 * versão v para v + 1, aplicadas em sequência até a versão atual.
 * O storage é injetável para teste (tests/helpers/fake-storage.ts).
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveEnvelope {
  version: number;
  savedAt: number;
  payload: unknown;
}

export type Migration = (old: unknown) => unknown;

export interface SaveStoreOptions<T> {
  key: string;
  /** Versão atual do formato do payload (≥ 1). */
  version: number;
  /** Deve ter exatamente `version - 1` entradas. */
  migrations: readonly Migration[];
  /** Validação do payload já migrado; falha → load() devolve null. */
  validate: (payload: unknown) => payload is T;
  /** Padrão: localStorage do navegador (se existir). */
  storage?: StorageLike;
  /** Relógio para `savedAt` (padrão Date.now). */
  now?: () => number;
}

function defaultStorage(): StorageLike | null {
  try {
    // Em modo privado de alguns navegadores o simples acesso lança.
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isEnvelope(v: unknown): v is SaveEnvelope {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as SaveEnvelope).version === 'number' &&
    typeof (v as SaveEnvelope).savedAt === 'number' &&
    'payload' in v
  );
}

export class SaveStore<T> {
  private readonly key: string;
  private readonly version: number;
  private readonly migrations: readonly Migration[];
  private readonly validate: (payload: unknown) => payload is T;
  private readonly storage: StorageLike | null;
  private readonly now: () => number;

  constructor(opts: SaveStoreOptions<T>) {
    if (opts.version < 1 || !Number.isInteger(opts.version)) {
      throw new Error(`SaveStore(${opts.key}): version deve ser inteiro ≥ 1`);
    }
    if (opts.migrations.length !== opts.version - 1) {
      throw new Error(
        `SaveStore(${opts.key}): esperadas ${opts.version - 1} migrations, recebidas ${opts.migrations.length}`,
      );
    }
    this.key = opts.key;
    this.version = opts.version;
    this.migrations = opts.migrations;
    this.validate = opts.validate;
    this.storage = opts.storage ?? defaultStorage();
    this.now = opts.now ?? Date.now;
  }

  /** null quando não há save, o JSON é inválido, a versão é mais nova ou a validação falha. */
  load(): T | null {
    if (!this.storage) return null;
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return null;
    }
    if (raw === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!isEnvelope(parsed)) return null;
    if (parsed.version > this.version || parsed.version < 1) return null;

    let payload = parsed.payload;
    try {
      for (let v = parsed.version; v < this.version; v++) {
        const migrate = this.migrations[v - 1];
        if (!migrate) return null;
        payload = migrate(payload);
      }
    } catch {
      return null;
    }
    return this.validate(payload) ? payload : null;
  }

  save(payload: T): void {
    if (!this.storage) return;
    const envelope: SaveEnvelope = { version: this.version, savedAt: this.now(), payload };
    try {
      this.storage.setItem(this.key, JSON.stringify(envelope));
    } catch {
      // Cota cheia ou storage bloqueado: perder o save é preferível a derrubar o jogo.
    }
  }

  clear(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(this.key);
    } catch {
      // idem save()
    }
  }
}
