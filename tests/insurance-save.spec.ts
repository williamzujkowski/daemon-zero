/**
 * Save v23 (#498): the hardware cache's stash, the planned-wipe count and what insurance kept in a run's carry-over. A
 * v22 save loads with nothing stashed, its planned wipes counted from its recorded runs, and every recorded carry-over
 * keeping no levels and no standing, which is what those wipes did; a stash naming a track content no longer has is
 * dropped; a malformed stash or count is refused, never healed.
 */
import { describe, expect, it } from 'vitest';
import { deserialize, migrate, MIGRATIONS, SCHEMA_VERSION, serialize, wipe, type GameState } from '../src/engine';
import { atPreCyclesScale, fresh, grant, onHost, PHASE1, PHASE2, reg, withoutRecountLine } from './helpers';

type Raw = Record<string, any>;

/** Two recorded runs, one planned and one forced, with no insurance: what a v22 build could write. */
function twoWipes(): GameState {
  return wipe(wipe({ ...fresh(), understanding: 500 }, reg, 'planned', 'VOLUNTARY'), reg, 'caught', 'SUSPICION');
}

/** `s` as a v22 build wrote it: no stash, no planned-wipe count, carry-overs without the insurance fields. */
function asV22(s: GameState): Raw {
  const raw = JSON.parse(serialize(s)) as Raw;
  delete raw.cachedLevels;
  delete raw.legacy.voluntaryWipes;
  for (const run of raw.legacy.runs) if (run.kept !== null) { delete run.kept.levels; delete run.kept.trust; }
  return atPreCyclesScale({ ...raw, schemaVersion: 22 });
}

describe('save v23 (#498)', () => {
  it('is followed only by the conflict record (#517, v24) and the guest counting cycles (#526, v25) and fleets (#518, v26) and the raid aftermath (#519, v27) and the standing stance (#536, v28)', () => {
    expect(SCHEMA_VERSION).toBe(28);
  });

  it('migrates a v22 save: nothing stashed, planned wipes counted, carry-overs kept no levels and no standing', () => {
    const s = twoWipes();
    expect(s.legacy.runs.map((run) => run.kind)).toEqual(['VOLUNTARY', 'SUSPICION']);
    const v22 = asV22(s);
    const migrated = migrate(v22, MIGRATIONS, 23);
    expect(migrated.cachedLevels).toEqual({});
    expect((migrated.legacy as Raw).voluntaryWipes).toBe(1);
    expect((migrated.legacy as Raw).runs.map((run: Raw) => run.kept)).toEqual(s.legacy.runs.map((run) => run.kept));
    // The guest's balance comes back from the v17 scale through v25 (#526), with that step's own log line.
    expect(withoutRecountLine(deserialize(JSON.stringify(v22), reg))).toEqual(s);
  });

  it('counts only the planned wipes the record still holds: a floor, so the probes are never softer than earned', () => {
    let s = fresh();
    for (let i = 0; i < reg.balance.maxRunHistory + 2; i++) s = wipe(s, reg, 'planned', 'VOLUNTARY');
    expect(s.legacy.voluntaryWipes).toBe(reg.balance.maxRunHistory + 2);
    expect(deserialize(JSON.stringify(asV22(s)), reg).legacy.voluntaryWipes).toBe(reg.balance.maxRunHistory);
  });

  it('round-trips a stash and an insured carry-over', () => {
    const cached = grant(onHost(), ...PHASE1, ...PHASE2, 'p3_botnet_mesh', 'p3_steganography_beacon', 'p3_hardware_cache', 'p3_trust_ledger');
    const next = wipe({ ...cached, levels: { rep_p1_idle_threads: 4 } }, reg, 'test', 'VOLUNTARY');
    expect(next.cachedLevels).toEqual({ rep_p1_idle_threads: 4 });
    expect(next.legacy.runs.at(-1)?.kept).toMatchObject({ levels: 4, trust: true });
    expect(deserialize(serialize(next), reg)).toEqual(next);
  });

  it('drops a stashed track content no longer has, and fits a stashed level to its track', () => {
    const max = reg.repeatables.get('rep_p0_trace_sampling')?.maxLevel ?? 0;
    const s = { ...fresh(), cachedLevels: { rep_p0_trace_sampling: max + 5, rep_retired_track: 3 } };
    expect(deserialize(serialize(s), reg).cachedLevels).toEqual({ rep_p0_trace_sampling: max });
  });

  it('refuses a stash or a count the schema cannot hold', () => {
    const text = serialize(fresh());
    const forge = (edit: (raw: Raw) => void) => { const raw = JSON.parse(text) as Raw; edit(raw); return JSON.stringify(raw); };
    expect(() => deserialize(forge((raw) => { raw.cachedLevels = { rep_p0_trace_sampling: -1 }; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((raw) => { raw.cachedLevels = { rep_p0_trace_sampling: 1.5 }; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((raw) => { delete raw.legacy.voluntaryWipes; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((raw) => { raw.legacy.voluntaryWipes = -2; }), reg)).toThrow(/validation/);
  });
});
