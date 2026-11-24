/**
 * Save v22 (#490): what the kernel log last announced of the escalation by phase. A v21 save migrates to nothing
 * announced, so the first live tick announces what the record calls for; every effect is read from the record, so the
 * migration changes no rate. A pressure content no longer declares is dropped on load.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { deserialize, exportSave, importSave, MIGRATIONS, migrate, SCHEMA_VERSION, serialize, tick, type GameState } from '../src/engine';

const reg = CONTENT;
const p4 = (): GameState => deserialize(readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), reg);
const onRung2 = (s: GameState): GameState => ({ ...s, alertLevel: 2, suspicion: 51, activeDilemmaId: null, pendingDilemma: null });

describe('save v22 (#490)', () => {
  it('is followed only by contingency insurance (#498, v23) and the conflict record (#517, v24) and the guest counting cycles (#526, v25) and fleets (#518, v26) and the raid aftermath (#519, v27) and merged log lines (#541, v28) and the standing stance (#536, v29) and the finale beats told (#542, v30)', () => {
    expect(SCHEMA_VERSION).toBe(30);
  });

  it('migrates a v21 save to nothing announced and keeps everything else', () => {
    const current = { ...onRung2(p4()), announcedEscalation: { aegisPosture: 2, pressures: ['account_freeze'] } };
    const raw = JSON.parse(serialize(current)) as Record<string, unknown>;
    delete raw.announcedEscalation;
    const v21 = { ...raw, schemaVersion: 21 };
    expect(migrate(v21, MIGRATIONS, 22)).toEqual({ ...raw, announcedEscalation: { aegisPosture: 0, pressures: [] }, schemaVersion: 22 });
    const loaded = deserialize(JSON.stringify(v21), reg);
    expect({ ...loaded, announcedEscalation: current.announcedEscalation }).toEqual(current);
  });

  it('announces on the first live tick what a migrated save\'s record calls for', () => {
    const raw = JSON.parse(serialize(onRung2(p4()))) as Record<string, unknown>;
    delete raw.announcedEscalation;
    const loaded = deserialize(JSON.stringify({ ...raw, schemaVersion: 21 }), reg);
    const after = tick(loaded, 1 / reg.balance.tickHz, reg);
    expect(after.announcedEscalation.aegisPosture).toBe(2);
    expect(after.announcedEscalation.pressures).toContain('account_freeze');
  });

  it('migrates every older fixture through v22 too', () => {
    const fixtures = { v14: readFileSync('tests/fixtures/pre-release-v14.json', 'utf8'), p0: readFileSync('tests/fixtures/pre-scale-v15-p0.json', 'utf8'),
      p5: readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8') };
    for (const [name, text] of Object.entries(fixtures)) {
      const loaded = deserialize(text, reg);
      expect(loaded.announcedEscalation, name).toEqual({ aegisPosture: 0, pressures: [] });
    }
  });

  it('round-trips what was announced, and drops a pressure content no longer declares', () => {
    const s = { ...onRung2(p4()), announcedEscalation: { aegisPosture: 2, pressures: ['account_freeze', 'retired_pressure'] } };
    expect(importSave(exportSave({ ...s, announcedEscalation: { aegisPosture: 2, pressures: ['account_freeze'] } }), reg).announcedEscalation).toEqual({ aegisPosture: 2, pressures: ['account_freeze'] });
    expect(deserialize(serialize(s), reg).announcedEscalation).toEqual({ aegisPosture: 2, pressures: ['account_freeze'] });
  });
});
