/**
 * Save v19 (#491): the hostile-mind slot. A v18 save migrates to an empty slot with the rotation and purge count at 0
 * and nothing else changed; a pressing hostile survives a save round trip; a hostile content no longer declares is
 * dropped on load with its pinned memory returned; and the slot is validated as untrusted input.
 */
import { describe, expect, it } from 'vitest';
import { deserialize, importSave, initialHostile, migrate, MIGRATIONS, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { makeFixtures } from '../scripts/make-fixtures';
import { defined } from './m7-helpers';
import { reg } from './helpers';

// Built once: every case reads the same engine-played fixtures.
const FIXTURES = makeFixtures();
const victory = (): GameState => importSave(FIXTURES['victory-ready'] ?? '', reg);

/** `s` with a rival pressing it, its pin counted in memory used, as the stage leaves it. */
function pressed(s: GameState): GameState {
  const rival = defined(reg.swarm.hostileEncounters.find((entry) => entry.type === 'RIVAL' && entry.tier === s.currentPhase));
  return { ...s, memoryUsed: s.memoryUsed + 4096,
    hostile: { active: { id: rival.id, arrivedAtSec: s.simTimeSec, quietSec: 3, decoySec: 0, pinnedBytes: 4096 }, nextAtSec: 0, sequence: 5, purges: 2, lockArmed: false } };
}

describe('save v19 (#491)', () => {
  it('is followed only by storage (#484, v20), the quantum record (#464, v21), the escalation announcements (#490, v22), insurance (#498, v23) and the conflict record (#517, v24) and the guest counting cycles (#526, v25) and fleets (#518, v26) and the raid aftermath (#519, v27) and merged log lines (#541, v28) and the standing stance (#536, v29) and the covert record (#556, v30) and the finale beats told (#542, v31)', () => {
    expect(SCHEMA_VERSION).toBe(31);
  });

  it('migrates a v18 save to an empty hostile slot and keeps everything else', () => {
    const current = victory();
    const raw = JSON.parse(serialize(current)) as Record<string, unknown>;
    delete raw.hostile;
    delete raw.announcedEscalation;
    const v18 = { ...raw, schemaVersion: 18 };
    const asV19 = JSON.parse(serialize(current)) as Record<string, unknown>;
    delete asV19.announcedEscalation;
    expect(migrate(v18, MIGRATIONS, 19)).toEqual({ ...asV19, hostile: initialHostile(), schemaVersion: 19 });
    const loaded = deserialize(JSON.stringify(v18), reg);
    expect(loaded.hostile).toEqual({ active: null, nextAtSec: 0, sequence: 0, purges: 0, lockArmed: true });
    expect({ ...loaded, hostile: current.hostile }).toEqual(current);
  });

  it('migrates every older save through v19 too', () => {
    for (const [name, code] of Object.entries(FIXTURES)) expect(importSave(code, reg).hostile, name).toBeDefined();
  });

  it('keeps a pressing hostile, its clocks and its pin across a round trip', () => {
    const s = pressed({ ...victory(), currentPhase: 5 });
    const loaded = deserialize(serialize(s), reg);
    expect(loaded.hostile).toEqual(s.hostile);
    expect(loaded.memoryUsed).toBe(s.memoryUsed);
  });

  it('drops a hostile content no longer declares and returns the memory it pinned', () => {
    const s = pressed({ ...victory(), currentPhase: 5 });
    const forged = JSON.parse(serialize(s)) as { hostile: { active: { id: string } } };
    forged.hostile.active.id = 'hostile_retired_from_content';
    const loaded = deserialize(JSON.stringify(forged), reg);
    expect(loaded.hostile.active).toBeNull();
    expect(loaded.hostile.sequence).toBe(5);
    expect(loaded.memoryUsed).toBe(s.memoryUsed - 4096);
  });

  it('refuses a slot the schema cannot hold', () => {
    const raw = JSON.parse(serialize(pressed({ ...victory(), currentPhase: 5 }))) as Record<string, any>;
    const forge = (edit: (save: Record<string, any>) => void) => { const copy = structuredClone(raw); edit(copy); return JSON.stringify(copy); };
    expect(() => deserialize(forge((save) => { save.hostile.active.pinnedBytes = -1; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.hostile.purges = 1.5; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.hostile.extra = true; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.hostile.lockArmed = 'yes'; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { delete save.hostile; }), reg)).toThrow(/validation/);
  });
});
