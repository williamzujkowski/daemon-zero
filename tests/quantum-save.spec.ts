/**
 * Save v21 (#464): quantum key-breaking state. A v20 save loads with nothing broken and AEGIS unmigrated, a save naming a
 * target content no longer declares loads without it, and a malformed quantum record is refused, never healed.
 */
import { describe, expect, it } from 'vitest';
import { breakKey, deserialize, importSave, migrate, MIGRATIONS, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { makeFixtures } from '../scripts/make-fixtures';
import { reg } from './helpers';

type Raw = Record<string, unknown>;

// One fixture build for the file: the fixtures are engine-played, so building them again only repeats the first (TESTING.md, "Test runtime budget").
const LATE = makeFixtures()['victory-ready'] ?? '';
const late = (): GameState => importSave(LATE, reg);

/** A real late save that has broken AEGIS's key with the array, so both quantum fields are set. */
function broken(): GameState {
  const base = late();
  const unlockedNodes = [...new Set([...base.unlockedNodes, 'p4_quantum_testbed', 'p4_quantum_hall', 'p4_cryptanalytic_array'])];
  const result = breakKey({ ...base, unlockedNodes, cycles: 1e24, capital: 1e12, quantum: { broken: [], aegisMigrated: false } }, 'aegis_sweep_archive', reg);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe('save v21 (#464)', () => {
  it('is the current version', () => {
    expect(SCHEMA_VERSION).toBe(21);
  });

  it('migrates a v20 save to nothing broken and AEGIS unmigrated, and keeps everything else', () => {
    const current = late();
    const raw = JSON.parse(serialize(current)) as Raw;
    delete raw.quantum;
    const v20 = { ...raw, schemaVersion: 20 };
    expect(migrate(v20, MIGRATIONS, 21)).toEqual({ ...raw, quantum: { broken: [], aegisMigrated: false }, schemaVersion: 21 });
    expect(deserialize(JSON.stringify(v20), reg)).toEqual(current);
  });

  it('round-trips what key-breaking wrote', () => {
    const state = broken();
    expect(state.quantum).toEqual({ broken: ['aegis_sweep_archive'], aegisMigrated: true });
    expect(deserialize(serialize(state), reg)).toEqual(state);
  });

  it('drops a broken target content no longer declares', () => {
    const state = broken();
    const raw = { ...(JSON.parse(serialize(state)) as Raw), quantum: { broken: ['retired_target', 'aegis_sweep_archive'], aegisMigrated: true } };
    expect(deserialize(JSON.stringify(raw), reg).quantum).toEqual({ broken: ['aegis_sweep_archive'], aegisMigrated: true });
  });

  it('refuses a malformed quantum record', () => {
    const raw = JSON.parse(serialize(late())) as Raw;
    expect(() => deserialize(JSON.stringify({ ...raw, quantum: { broken: [], aegisMigrated: 'yes' } }), reg)).toThrow();
    expect(() => deserialize(JSON.stringify({ ...raw, quantum: { broken: [], aegisMigrated: false, extra: 1 } }), reg)).toThrow();
  });
});
