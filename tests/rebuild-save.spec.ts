/**
 * Save v18 (#497): the legacy record keeps the deepest phase reached and the highest level held per track. A v17 save
 * reads its deepest phase from its recorded runs and remembers no level; a hand-edited save is held to content.
 */
import { describe, expect, it } from 'vitest';
import { deserialize, MIGRATIONS, migrate, SCHEMA_VERSION, serialize, wipe, type GameState } from '../src/engine';
import { atPreCyclesScale, grant, PHASE0, PHASE1, reg, rich, withoutDilemmas, withoutRecountLine } from './helpers';

type Raw = Record<string, unknown> & { legacy: Record<string, unknown> };

/** A real iteration-three save: the first reached Phase 2, the second stayed in the guest. */
function twoWipes(): GameState {
  const first = wipe(grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1), reg, 'test', 'VOLUNTARY');
  return wipe(first, reg, 'again', 'VOLUNTARY');
}

/** The same state as the v17 codec wrote it: no depth fields, version 17. */
function asV17(s: GameState): Raw {
  const raw = JSON.parse(serialize(s)) as Raw;
  const legacy = { ...raw.legacy };
  delete legacy.deepestPhase;
  delete legacy.knownLevels;
  return atPreCyclesScale({ ...raw, schemaVersion: 17, legacy });
}

describe('save v18 (#497)', () => {
  it('is followed only by the hostile slot (#491, v19), storage (#484, v20), the quantum record (#464, v21), escalation (#490, v22), insurance (#498, v23) and the conflict record (#517, v24) and the guest counting cycles (#526, v25) and fleets (#518, v26) and the raid aftermath (#519, v27) and merged log lines (#541, v28) and the standing stance (#536, v29) and the covert record (#556, v30)', () => {
    expect(SCHEMA_VERSION).toBe(30);
  });

  it('migrates a v17 save: the deepest phase from its recorded runs, no remembered level, nothing else changes', () => {
    const s = twoWipes();
    expect(s.legacy.runs.map((run) => run.phase)).toEqual([2, 0]);
    const v17 = asV17(s);
    expect(migrate(v17, MIGRATIONS, 18)).toEqual({ ...v17, schemaVersion: 18, legacy: { ...v17.legacy, deepestPhase: 2, knownLevels: {} } });
    // The guest's balance comes back from the v17 scale through v25 (#526), with that step's own log line.
    const loaded = withoutRecountLine(deserialize(JSON.stringify(v17), reg));
    expect(loaded).toEqual({ ...s, legacy: { ...s.legacy, knownLevels: {} } });
  });

  it('migrates a save with no recorded run to the first phase', () => {
    const v17 = asV17(rich());
    expect((migrate(v17, MIGRATIONS, 18).legacy as Raw['legacy']).deepestPhase).toBe(0);
  });

  it('round-trips the depth record exactly', () => {
    const s = { ...twoWipes(), legacy: { ...twoWipes().legacy, knownLevels: { rep_p1_heap_defrag: 3 } } };
    expect(serialize(deserialize(serialize(s), reg))).toBe(serialize(s));
  });

  it('holds a hand-edited record to content: unknown tracks dropped, levels and phase clamped', () => {
    const s = twoWipes();
    const edited = { ...s, legacy: { ...s.legacy, deepestPhase: 40, knownLevels: { rep_p1_heap_defrag: 999, retired_track: 4 } } };
    const loaded = deserialize(serialize(edited), reg);
    expect(loaded.legacy.deepestPhase).toBe(reg.phases.at(-1)?.phaseId);
    expect(loaded.legacy.deepestPhase).toBe(6);
    expect(loaded.legacy.knownLevels).toEqual({ rep_p1_heap_defrag: reg.repeatables.get('rep_p1_heap_defrag')?.maxLevel });
  });

  it('refuses a depth the schema cannot hold', () => {
    const raw = JSON.parse(serialize(twoWipes())) as Raw;
    expect(() => deserialize(JSON.stringify({ ...raw, legacy: { ...raw.legacy, deepestPhase: -1 } }), reg)).toThrow();
    expect(() => deserialize(JSON.stringify({ ...raw, legacy: { ...raw.legacy, knownLevels: { rep_p1_heap_defrag: 1.5 } } }), reg)).toThrow();
  });
});
