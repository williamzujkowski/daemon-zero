/**
 * Save v26 (#518): fleets and drift deviants. A v25 save migrates to every fleet SUPERVISED with nothing lost and a raid
 * under way kept as a rival's, with no engagement and no split share, and nothing else changes; fleet records and a
 * deviant battle survive a round trip; a record content does not declare, losses past the cap, an engagement on an
 * attrition raid and a split share on a rival are put right or dropped; and the record is validated as untrusted input.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserialize, exportSave, importSave, initialConflict, MIGRATIONS, migrate, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { reg } from './helpers';
import { arrived, raid, ready, withBotnet } from './conflict-helpers';
import { CREWS, DRONES, F } from './fleet-helpers';

const p4 = (): GameState => deserialize(readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), reg);
/**
 * The Phase 4 save with free-ranging fleets and a deviant drone wing through its engagement, as the stages would leave
 * it, loaded once so what ownership implies is derived.
 */
const fought = (): GameState => {
  const s = p4(), deviant = 'deviant_drone_fleet';
  const engagement = { force: 4, lethality: 1.25, fleet: 18, floor: 12.5, attackerWins: false, forceAfter: 0, fleetAfter: Math.sqrt(18 * 18 - 1.25 * 16) };
  return deserialize(serialize({ ...s, levels: { ...s.levels, [DRONES]: 40, [CREWS]: 10 }, hostile: { ...s.hostile, active: null },
    conflict: { ...s.conflict, fleets: { [DRONES]: { autonomy: 'ELEVATED', drift: 0, lost: 0.25 }, [CREWS]: { autonomy: 'STANDARD', drift: 40, lost: 0.03 } },
      raid: { id: deviant, stage: 'AFTERMATH', stageSec: 2, arrivedAtSec: s.simTimeSec, target: 'halls', force: 4, quietSec: 0, attributed: true, rounds: [],
        engagement, splitShare: F.splitShare } } }), reg);
};

describe('save v26 (#518)', () => {
  it('is followed only by the raid aftermath (#519, v27) and merged log lines (#541, v28) and the standing stance (#536, v29) and the covert record (#556, v30)', () => {
    expect(SCHEMA_VERSION).toBe(30);
  });

  it('migrates a v25 save to no fleet records and keeps everything else', () => {
    const current = p4();
    const raw = JSON.parse(serialize(current)) as Record<string, any>;
    const v25 = { ...raw, schemaVersion: 25, conflict: { ...raw.conflict } };
    delete v25.conflict.fleets;
    expect(migrate(v25, MIGRATIONS, 26)).toEqual({ ...raw, schemaVersion: 26 });
    expect(deserialize(JSON.stringify(v25), reg)).toEqual(current);
  });

  it('keeps a v25 raid under way as a rival\'s, with no engagement fought and no split share', () => {
    const s = arrived(withBotnet(ready(3)), raid('raid_p3_ddos'));
    const raw = JSON.parse(serialize(s)) as Record<string, any>;
    const v25 = structuredClone(raw);
    v25.schemaVersion = 25;
    delete v25.conflict.fleets;
    delete v25.conflict.raid.engagement;
    delete v25.conflict.raid.splitShare;
    const loaded = deserialize(JSON.stringify(v25), reg);
    expect(loaded.conflict.raid).toEqual({ ...s.conflict.raid, engagement: null, splitShare: 0 });
    expect(loaded.conflict.fleets).toEqual({});
  });

  it('migrates every older fixture through v26 too', () => {
    const fixtures = { v14: readFileSync('tests/fixtures/pre-release-v14.json', 'utf8'), p0: readFileSync('tests/fixtures/pre-scale-v15-p0.json', 'utf8'),
      p5: readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8') };
    for (const [name, text] of Object.entries(fixtures)) expect(deserialize(text, reg).conflict, name).toEqual(initialConflict());
  });

  it('keeps fleet records and a deviant\'s battle across a round trip, byte for byte', () => {
    const s = fought();
    expect(s.conflict.raid?.engagement).not.toBeNull();
    expect(s.conflict.raid?.splitShare).toBe(F.splitShare);
    expect(s.conflict.fleets[DRONES]?.autonomy).toBe('ELEVATED');
    const text = serialize(s);
    expect(serialize(deserialize(text, reg))).toBe(text);
    expect(importSave(exportSave(s), reg).conflict).toEqual(s.conflict);
  });

  it('drops a record for no declared fleet, clamps losses to the cap, and drops a raid whose record its kind cannot carry', () => {
    const s = fought();
    const forge = (edit: (save: Record<string, any>) => void): GameState => {
      const copy = JSON.parse(serialize(s)) as Record<string, any>;
      edit(copy);
      return deserialize(JSON.stringify(copy), reg);
    };
    expect(forge((save) => { save.conflict.fleets.rep_retired_fleet = { autonomy: 'STANDARD', drift: 3, lost: 0 }; }).conflict.fleets.rep_retired_fleet).toBeUndefined();
    expect(forge((save) => { save.conflict.fleets[DRONES].lost = 0.9; }).conflict.fleets[DRONES]?.lost).toBe(F.lossCap);
    expect(forge((save) => { save.conflict.raid.splitShare = 0; }).conflict.raid).toBeNull();
    expect(forge((save) => { save.conflict.raid.splitShare = 0.9; }).conflict.raid).toBeNull();
    const rival = arrived(withBotnet(ready(3)), raid('raid_p3_ddos'));
    const forgeRival = (edit: (save: Record<string, any>) => void): GameState => {
      const copy = JSON.parse(serialize(rival)) as Record<string, any>;
      edit(copy);
      return deserialize(JSON.stringify(copy), reg);
    };
    expect(forgeRival((save) => { save.conflict.raid.splitShare = 0.2; }).conflict.raid).toBeNull();
    expect(forgeRival((save) => { save.conflict.raid.engagement = { force: 1, lethality: 1, fleet: 0, floor: 0, attackerWins: true, forceAfter: 1, fleetAfter: 0 }; })
      .conflict.raid).toBeNull();
  });

  it('refuses a record the schema cannot hold', () => {
    const raw = JSON.parse(serialize(fought())) as Record<string, any>;
    const forge = (edit: (save: Record<string, any>) => void) => { const copy = structuredClone(raw); edit(copy); return JSON.stringify(copy); };
    expect(() => deserialize(forge((save) => { save.conflict.fleets[DRONES].autonomy = 'ROGUE'; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.conflict.fleets[DRONES].drift = 101; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.conflict.fleets[DRONES].lost = -0.1; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.conflict.fleets[DRONES].extra = true; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.conflict.raid.engagement.attackerWins = 'yes'; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { delete save.conflict.fleets; }), reg)).toThrow(/validation/);
  });
});
