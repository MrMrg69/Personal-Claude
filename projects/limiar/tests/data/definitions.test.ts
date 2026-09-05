import { describe, expect, it } from 'vitest';
import { DEFS, DefinitionError, countDefs, validateDefs, type DefRegistry } from '@/data';
import type { LevelDef } from '@/data/levels/level-def';
import { TEST_GROUND } from '@/data/levels/test-ground';

/** Registro com um nível substituído (para quebrar de propósito). */
function withLevel(level: LevelDef): DefRegistry {
  return { ...DEFS, levels: { [level.id]: level } };
}

describe('validateDefs', () => {
  it('o registro real passa', () => {
    expect(() => validateDefs(DEFS)).not.toThrow();
    expect(countDefs(DEFS)).toEqual({ elements: 3, factions: 3, levels: 1 });
  });

  it('id diferente da chave do registro falha', () => {
    const broken: DefRegistry = { ...DEFS, elements: { ...DEFS.elements, fire: DEFS.elements.ember } };
    expect(() => validateDefs(broken)).toThrow(DefinitionError);
    expect(() => validateDefs(broken)).toThrow(/elements\.fire\.id/);
  });

  it('cor fora de 0x000000–0xffffff falha com caminho legível', () => {
    const broken: DefRegistry = {
      ...DEFS,
      factions: { ...DEFS.factions, rust: { ...DEFS.factions.rust, color: 0x1000000 } },
    };
    expect(() => validateDefs(broken)).toThrow(/factions\.rust\.color/);
  });

  it('nível sem spawn "player" falha', () => {
    const level: LevelDef = { ...TEST_GROUND, spawnPoints: TEST_GROUND.spawnPoints.filter((s) => s.tag !== 'player') };
    expect(() => validateDefs(withLevel(level))).toThrow(/spawnPoints/);
  });

  it('killPlaneY ≥ 0 falha', () => {
    expect(() => validateDefs(withLevel({ ...TEST_GROUND, killPlaneY: 0 }))).toThrow(/killPlaneY/);
  });

  it('spawn fora dos bounds e primitiva com tamanho zero falham', () => {
    const farSpawn: LevelDef = { ...TEST_GROUND, spawnPoints: [{ pos: [0, 0, 999], yawDeg: 0, tag: 'player' }] };
    expect(() => validateDefs(withLevel(farSpawn))).toThrow(/spawnPoints\[0\]\.pos/);
    const flat: LevelDef = { ...TEST_GROUND, props: [{ kind: 'box', pos: [0, 0, 0], size: [1, 0, 1], color: 0 }] };
    expect(() => validateDefs(withLevel(flat))).toThrow(/props\[0\]\.size\[1\]/);
  });
});

describe('Campo de Provas', () => {
  it('tem spawn em (0, 0, 12) olhando −Z, 4 spawns de inimigo e 6 pontos de cobertura', () => {
    const player = TEST_GROUND.spawnPoints.find((s) => s.tag === 'player');
    expect(player?.pos).toEqual([0, 0, 12]);
    expect(player?.yawDeg).toBe(0);
    expect(TEST_GROUND.spawnPoints.filter((s) => s.tag === 'enemy')).toHaveLength(4);
    expect(TEST_GROUND.coverPoints).toHaveLength(6);
    expect(TEST_GROUND.killPlaneY).toBe(-20);
    expect(TEST_GROUND.bounds.halfSize).toBe(60);
  });

  it('tem as três rampas com os ângulos do design (20,6° / 40° / 53°)', () => {
    const ramps = TEST_GROUND.props.filter((p) => p.kind === 'ramp');
    const angles = ramps.map((r) => Math.round((Math.atan2(r.rise, r.run) * 180) / Math.PI * 10) / 10).sort((a, b) => a - b);
    expect(angles).toEqual([20.6, 40, 53.1]);
  });

  it('todos os props ficam dentro dos limites do mundo', () => {
    const half = TEST_GROUND.bounds.halfSize + 1;
    for (const p of TEST_GROUND.props) {
      expect(Math.abs(p.pos[0])).toBeLessThanOrEqual(half);
      expect(Math.abs(p.pos[2])).toBeLessThanOrEqual(half);
    }
  });
});
