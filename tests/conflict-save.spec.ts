/**
 * Save v24 (#517): the conflict record. A v23 save migrates to no raid under way, nothing damaged and both counters at
 * 0, and nothing else changes; a raid in progress and site damage survive a round trip; a raid or class content no
 * longer declares is dropped, damage past the cap is clamped, a raid sharing the slot with a hostile mind is dropped,
 * and the record is validated as untrusted input.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserialize, exportSave, importSave, initialConflict, MIGRATIONS, migrate, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { reg } from './helpers';
import { arrived, PRE_BATTLE, R, raid, ready, run, withBotnet } from './conflict-helpers';

const p4 = (): GameState => deserialize(readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), reg);
/**
 * A raid two rounds into its battle, with the damage it has done, loaded once so what ownership implies (the storage the
 * botnet a fixture granted by hand holds) is derived as any save's is.
 */
const mid = (): GameState => deserialize(serialize(run(arrived(withBotnet(ready(3)), raid('raid_p3_ddos')), PRE_BATTLE + 2 * R.roundSec)), reg);

describe('save v24 (#517)', () => {
  it('is followed only by the guest counting cycles (#526, v25) and fleets (#518, v26) and the raid aftermath (#519, v27) and merged log lines (#541, v28) and the standing stance (#536, v29)', () => {
    expect(SCHEMA_VERSION).toBe(29);
  });

  it('migrates a v23 save to no raid, nothing damaged and both counters at 0, and keeps everything else', () => {
    const current = p4();
    const raw = JSON.parse(serialize(current)) as Record<string, unknown>;
    delete raw.conflict;
    const v23 = { ...raw, schemaVersion: 23 };
    // The v24 step writes the record as v24 had it; v25 (#518) adds the fleets after it.
    expect(migrate(v23, MIGRATIONS, 24)).toEqual({ ...raw, conflict: { raid: null, nextRaidAtSec: 0, raids: 0, attributions: 0, damage: {} }, schemaVersion: 24 });
    const loaded = deserialize(JSON.stringify(v23), reg);
    // v27 (#519) then adds the raid aftermath and the silenced raiders, neither held.
    expect(loaded.conflict).toEqual(initialConflict());
    expect(loaded).toEqual(current);
  });

  it('migrates every older fixture through v24 too', () => {
    const fixtures = { v14: readFileSync('tests/fixtures/pre-release-v14.json', 'utf8'), p0: readFileSync('tests/fixtures/pre-scale-v15-p0.json', 'utf8'),
      p5: readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8') };
    for (const [name, text] of Object.entries(fixtures)) expect(deserialize(text, reg).conflict, name).toEqual(initialConflict());
  });

  it('keeps a raid in progress, its battle log and the damage it did across a round trip, byte for byte', () => {
    const s = mid();
    expect(s.conflict.raid?.rounds).toHaveLength(2);
    const text = serialize(s);
    expect(serialize(deserialize(text, reg))).toBe(text);
    expect(importSave(exportSave(s), reg).conflict).toEqual(s.conflict);
  });

  it('drops a raid or a damaged class content no longer declares, clamps damage to the cap, and drops a raid sharing the slot', () => {
    const s = mid();
    const forge = (edit: (save: Record<string, any>) => void): GameState => {
      const copy = JSON.parse(serialize(s)) as Record<string, any>;
      edit(copy);
      return deserialize(JSON.stringify(copy), reg);
    };
    expect(forge((save) => { save.conflict.raid.id = 'raid_retired_from_content'; }).conflict.raid).toBeNull();
    expect(forge((save) => { save.conflict.raid.target = 'no_such_class'; }).conflict.raid).toBeNull();
    expect(forge((save) => { save.conflict.damage = { retired_class: 0.3, botnet: 0.9 }; }).conflict.damage).toEqual({ botnet: R.damageCap });
    const hostile = defined(reg.swarm.hostileEncounters.find((entry) => entry.tier === 3));
    const shared = forge((save) => { save.hostile.active = { id: hostile.id, arrivedAtSec: 0, quietSec: 0, decoySec: 0, pinnedBytes: 0 }; });
    expect(shared.conflict.raid).toBeNull();
    expect(shared.hostile.active?.id).toBe(hostile.id);
  });

  it('refuses a record the schema cannot hold', () => {
    const raw = JSON.parse(serialize(mid())) as Record<string, any>;
    const forge = (edit: (save: Record<string, any>) => void) => { const copy = structuredClone(raw); edit(copy); return JSON.stringify(copy); };
    expect(() => deserialize(forge((save) => { save.conflict.damage.botnet = 1.5; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.conflict.raid.stage = 'SIEGE'; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.conflict.raid.force = 0; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.conflict.raids = -1; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.conflict.extra = true; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { delete save.conflict; }), reg)).toThrow(/validation/);
  });
});
