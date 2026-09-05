import { describe, expect, it } from 'vitest';

/**
 * Regras de dependência entre pastas (design §3.2). Lê os fontes como texto e
 * aplica regex sobre os imports de valor (`import type` é ignorado).
 */
const sources = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

type Folder = 'core' | 'data' | 'entities' | 'world' | 'systems' | 'ui' | 'game' | 'root';

/** O que cada pasta pode importar de VALOR (three e pastas). 'three' cobre three/addons. */
const ALLOWED: Record<Folder, readonly (Folder | 'three')[]> = {
  core: ['three', 'core'],
  data: ['data'],
  // §3.2 lista só core/data para entities/, mas §10.1 manda static-world usar world/level-builder;
  // world/ não importa entities/, então não há ciclo.
  entities: ['three', 'core', 'data', 'world', 'entities'],
  world: ['three', 'core', 'data', 'world'],
  systems: ['three', 'core', 'data', 'entities', 'world', 'systems'],
  ui: ['core', 'data', 'ui'],
  game: ['three', 'core', 'data', 'entities', 'world', 'systems', 'ui', 'game'],
  root: ['three', 'core', 'data', 'entities', 'world', 'systems', 'ui', 'game'],
};

/** Pastas que só podem ser importadas como tipo pela pasta de origem (design §3.2). */
const TYPE_ONLY: Partial<Record<Folder, readonly Folder[]>> = {
  data: ['core'],
  systems: ['game'],
  ui: ['game'],
};

const FOLDERS: readonly Folder[] = ['core', 'data', 'entities', 'world', 'systems', 'ui', 'game'];

function folderOfFile(file: string): Folder {
  const m = /^\/src\/([^/]+)\//.exec(file);
  const f = m?.[1];
  return f && (FOLDERS as readonly string[]).includes(f) ? (f as Folder) : 'root';
}

function resolveTarget(file: string, spec: string): Folder | 'three' | null {
  if (spec === 'three' || spec.startsWith('three/')) return 'three';
  let path: string;
  if (spec.startsWith('@/')) {
    path = `/src/${spec.slice(2)}`;
  } else if (spec.startsWith('.')) {
    const dir = file.slice(0, file.lastIndexOf('/'));
    const parts = `${dir}/${spec}`.split('/');
    const out: string[] = [];
    for (const p of parts) {
      if (p === '..') out.pop();
      else if (p !== '.' && p !== '') out.push(p);
    }
    path = `/${out.join('/')}`;
  } else {
    return null; // dependência externa desconhecida (nenhuma prevista em M0)
  }
  return folderOfFile(`${path}/`);
}

/** Todos os `import ... from 'x'`, `import 'x'` e `export ... from 'x'`, marcando os type-only. */
function importsOf(source: string): { spec: string; typeOnly: boolean }[] {
  const out: { spec: string; typeOnly: boolean }[] = [];
  const re = /(?:^|\n)\s*(import|export)\s+(type\s+)?([\s\S]*?)from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(re)) {
    if (m[5] !== undefined) {
      out.push({ spec: m[5], typeOnly: false });
      continue;
    }
    const clause = m[3] ?? '';
    const spec = m[4] ?? '';
    // `import type { A }` ou `import { type A, type B }` (todos os especificadores com `type`).
    const allInlineType =
      clause.includes('{') &&
      clause
        .replace(/[{}]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .every((s) => s.startsWith('type '));
    out.push({ spec, typeOnly: m[2] !== undefined || allInlineType });
  }
  return out;
}

describe('arquitetura: dependências entre pastas (§3.2)', () => {
  const files = Object.keys(sources);

  it('encontrou os fontes', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    const from = folderOfFile(file);
    const source = sources[file] ?? '';
    it(`${file} só importa o permitido para ${from}/`, () => {
      const violations: string[] = [];
      for (const { spec, typeOnly } of importsOf(source)) {
        const target = resolveTarget(file, spec);
        if (target === null || target === 'root') continue;
        if (typeOnly) {
          const typeAllowed = ALLOWED[from].includes(target) || TYPE_ONLY[from]?.includes(target as Folder);
          if (!typeAllowed) violations.push(`import type de '${spec}' (${target})`);
          continue;
        }
        if (!ALLOWED[from].includes(target)) violations.push(`import de valor de '${spec}' (${target})`);
      }
      expect(violations).toEqual([]);
    });
  }

  it('data/ não importa three nem como tipo de valor (só tipos de core)', () => {
    for (const file of files.filter((f) => folderOfFile(f) === 'data')) {
      const source = sources[file] ?? '';
      expect(source, file).not.toMatch(/from\s*['"]three/);
    }
  });
});
