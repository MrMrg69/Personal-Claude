import { ELEMENTS, type ElementDef } from './elements';
import { FACTIONS, type FactionDef } from './factions';
import type { LevelDef, PrimitiveDef } from './levels/level-def';
import { TEST_GROUND } from './levels/test-ground';

export type { ElementDef, ElementId } from './elements';
export type { FactionDef, FactionId } from './factions';

export const LEVELS = {
  'test-ground': TEST_GROUND,
} as const satisfies Readonly<Record<string, LevelDef>>;

export type LevelId = keyof typeof LEVELS;

/**
 * Registro de definições (design §3.5). Famílias novas (M1+: weapons, enemies,
 * items, lootTables, classes, abilities) entram aqui e em validateDefs.
 */
export interface DefRegistry {
  readonly elements: Readonly<Record<string, ElementDef>>;
  readonly factions: Readonly<Record<string, FactionDef>>;
  readonly levels: Readonly<Record<string, LevelDef>>;
}

export const DEFS = {
  elements: ELEMENTS,
  factions: FACTIONS,
  levels: LEVELS,
} as const satisfies DefRegistry;

/** Erro de dado com caminho legível: 'levels.test-ground.killPlaneY: deve ser negativo'. */
export class DefinitionError extends Error {
  constructor(
    readonly path: string,
    detail: string,
  ) {
    super(`${path}: ${detail}`);
    this.name = 'DefinitionError';
  }
}

const MAX_HEX_COLOR = 0xffffff;

function isHexColor(c: unknown): c is number {
  return typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= MAX_HEX_COLOR;
}

function fail(path: string, detail: string): never {
  throw new DefinitionError(path, detail);
}

function checkColor(path: string, c: unknown): void {
  if (!isHexColor(c)) fail(path, `cor inválida (${String(c)}); esperado inteiro 0x000000–0xffffff`);
}

function checkPositive(path: string, v: number): void {
  if (!(Number.isFinite(v) && v > 0)) fail(path, `deve ser > 0 (recebido ${v})`);
}

function checkVec3(path: string, v: readonly number[]): void {
  if (v.length !== 3 || !v.every(Number.isFinite)) fail(path, 'esperado [x, y, z] finito');
}

/** Ids únicos por família e chave do registro igual ao `id` da definição. */
function validateFamily(family: string, defs: Readonly<Record<string, { id: string; name: string }>>): void {
  const seen = new Set<string>();
  for (const [key, def] of Object.entries(defs)) {
    const path = `${family}.${key}`;
    if (def.id !== key) fail(`${path}.id`, `deve ser igual à chave do registro ('${def.id}')`);
    if (seen.has(def.id)) fail(`${path}.id`, 'id duplicado');
    seen.add(def.id);
    if (def.name.trim().length === 0) fail(`${path}.name`, 'nome vazio');
  }
}

function validatePrimitive(path: string, p: PrimitiveDef): void {
  checkVec3(`${path}.pos`, p.pos);
  checkColor(`${path}.color`, p.color);
  switch (p.kind) {
    case 'box':
      checkVec3(`${path}.size`, p.size);
      for (let i = 0; i < 3; i++) checkPositive(`${path}.size[${i}]`, p.size[i] ?? 0);
      break;
    case 'ramp':
      checkPositive(`${path}.run`, p.run);
      checkPositive(`${path}.rise`, p.rise);
      checkPositive(`${path}.width`, p.width);
      break;
    case 'cylinder':
      checkPositive(`${path}.radius`, p.radius);
      checkPositive(`${path}.height`, p.height);
      if (p.bands) {
        if (p.bands.length === 0) fail(`${path}.bands`, 'lista vazia; omita para cor única');
        p.bands.forEach((c, i) => checkColor(`${path}.bands[${i}]`, c));
      }
      if (p.segments !== undefined && !(Number.isInteger(p.segments) && p.segments >= 3)) {
        fail(`${path}.segments`, 'esperado inteiro ≥ 3');
      }
      break;
  }
}

function validateLevel(path: string, level: LevelDef): void {
  if (!(level.killPlaneY < 0)) fail(`${path}.killPlaneY`, `deve ser negativo (recebido ${level.killPlaneY})`);
  checkPositive(`${path}.bounds.halfSize`, level.bounds.halfSize);
  if (!level.spawnPoints.some((s) => s.tag === 'player')) fail(`${path}.spawnPoints`, "nenhum spawn com tag 'player'");
  const half = level.bounds.halfSize;
  level.spawnPoints.forEach((s, i) => {
    const sp = `${path}.spawnPoints[${i}]`;
    checkVec3(`${sp}.pos`, s.pos);
    if (Math.abs(s.pos[0]) > half || Math.abs(s.pos[2]) > half) fail(`${sp}.pos`, 'fora de bounds.halfSize');
    if (!Number.isFinite(s.yawDeg)) fail(`${sp}.yawDeg`, 'esperado número finito');
  });
  level.coverPoints.forEach((c, i) => checkVec3(`${path}.coverPoints[${i}]`, c));
  const names = new Set<string>();
  level.props.forEach((p, i) => {
    const pp = `${path}.props[${i}]`;
    validatePrimitive(pp, p);
    if (p.name !== undefined) {
      if (names.has(p.name)) fail(`${pp}.name`, `nome duplicado '${p.name}'`);
      names.add(p.name);
    }
  });
}

/**
 * Valida o registro inteiro; lança DefinitionError na primeira violação.
 * Roda em DEV (game.ts) e em tests/data/definitions.test.ts — dado quebrado
 * falha no `npm test` antes de chegar ao navegador (substitui zod a custo zero).
 */
export function validateDefs(defs: DefRegistry): void {
  validateFamily('elements', defs.elements);
  validateFamily('factions', defs.factions);
  validateFamily('levels', defs.levels);

  for (const [key, e] of Object.entries(defs.elements)) checkColor(`elements.${key}.color`, e.color);
  for (const [key, f] of Object.entries(defs.factions)) {
    checkColor(`factions.${key}.color`, f.color);
    if (f.units.length === 0) fail(`factions.${key}.units`, 'lista vazia');
  }
  for (const [key, level] of Object.entries(defs.levels)) validateLevel(`levels.${key}`, level);
}

/** Contagens para o HUD de debug ("defs: 3 elementos, 3 facções, 1 nível"). */
export function countDefs(defs: DefRegistry): { elements: number; factions: number; levels: number } {
  return {
    elements: Object.keys(defs.elements).length,
    factions: Object.keys(defs.factions).length,
    levels: Object.keys(defs.levels).length,
  };
}
