/**
 * Save v26 (#519): a raid's aftermath and the raiders a retaliation silenced. A v25 save migrates to neither held and
 * nothing else changes; both survive a round trip; a raid content no longer declares is dropped from both, a silenced
 * raider is listed once, and the record is validated as untrusted input.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserialize, exportSave, importSave, MIGRATIONS, migrate, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { reg } from './helpers';

const p4 = (): GameState => deserialize(readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), reg);
const answered = (): GameState => {
  const s = p4();
  return { ...s, conflict: { ...s.conflict, lastRaid: { id: 'raid_p4_break_in', named: true, breach: 0.625, harm: 'HURT' }, silenced: ['raid_p3_ddos'] } };
};
const forge = (s: GameState, edit: (save: Record<string, any>) => void): GameState => {
  const copy = JSON.parse(serialize(s)) as Record<string, any>;
  edit(copy);
  return deserialize(JSON.stringify(copy), reg);
};

describe('save v26 (#519)', () => {
  it('is the current version', () => {
    expect(SCHEMA_VERSION).toBe(26);
  });

  it('migrates a v25 save to no aftermath and nothing silenced, and keeps everything else', () => {
    const current = p4();
    const raw = JSON.parse(serialize(current)) as Record<string, any>;
    const v25Conflict = { ...(raw.conflict as Record<string, unknown>) };
    delete v25Conflict.lastRaid;
    delete v25Conflict.silenced;
    const v25 = { ...raw, conflict: v25Conflict, schemaVersion: 25 };
    expect(migrate(v25, MIGRATIONS, 26)).toEqual({ ...raw, schemaVersion: 26 });
    expect(deserialize(JSON.stringify(v25), reg)).toEqual(current);
  });

  it('keeps the aftermath and the silenced raiders across a round trip, byte for byte', () => {
    const s = answered();
    const text = serialize(s);
    expect(serialize(deserialize(text, reg))).toBe(text);
    expect(importSave(exportSave(s), reg).conflict).toEqual(s.conflict);
  });

  it('drops what content no longer declares and lists a silenced raider once', () => {
    const s = answered();
    expect(forge(s, (save) => { save.conflict.lastRaid.id = 'raid_retired_from_content'; }).conflict.lastRaid).toBeNull();
    expect(forge(s, (save) => { save.conflict.silenced = ['raid_p3_ddos', 'raid_gone', 'raid_p3_ddos']; }).conflict.silenced).toEqual(['raid_p3_ddos']);
  });

  it('refuses a malformed aftermath', () => {
    expect(() => forge(answered(), (save) => { save.conflict.lastRaid.breach = 1.5; })).toThrow();
    expect(() => forge(answered(), (save) => { save.conflict.lastRaid.named = 'yes'; })).toThrow();
    expect(() => forge(answered(), (save) => { delete save.conflict.silenced; })).toThrow();
  });
});
