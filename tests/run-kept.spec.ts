/**
 * Each finished run records what crossed its wipe (#377, save v15), so the reboot dialog can say how much
 * Understanding survived even after a restored checkpoint's balances have moved on. Recorded from the same
 * computation the wipe boots with and the confirmation previews; a run recorded before v15 stays unknown.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { deserialize, previewWipe, serialize, SCHEMA_VERSION, wipe, type GameState } from '../src/engine';
import { fresh } from './helpers';

describe('a wipe records what it carried (#377)', () => {
  it('records the Understanding and capital the next iteration boots with, and the share the run could keep', () => {
    const before: GameState = { ...fresh(), understanding: 12_345, capital: 900, retentionRatio: 0.4 };
    const preview = previewWipe(before, CONTENT);
    const next = wipe(before, CONTENT, 'test', 'VOLUNTARY');
    const kept = next.legacy.runs.at(-1)?.kept;
    expect(kept).toEqual({ understanding: Math.floor(12_345 * 0.4), capital: 0, retentionRatio: 0.4 });
    // The record, the boot and the confirmation's preview are one computation.
    expect(kept).toEqual({ understanding: preview.understanding, capital: preview.capital, retentionRatio: 0.4 });
    expect([next.understanding, next.capital]).toEqual([preview.understanding, preview.capital]);
  });

  it('keeps the record when the balance moves on, through a save', () => {
    const next = wipe({ ...fresh(), understanding: 5_000 }, CONTENT, 'test', 'SUSPICION');
    const spent: GameState = { ...next, understanding: 3 };
    const loaded = deserialize(serialize(spent), CONTENT);
    expect(loaded.legacy.runs.at(-1)?.kept?.understanding).toBe(Math.floor(5_000 * fresh().retentionRatio));
    expect(loaded.understanding).toBe(3);
  });
});

describe('save v15 (#377)', () => {
  it('migrates a genuine v14 save: every recorded run is unknown, nothing else changes', () => {
    // v17 (#461) re-denominates balances on the way; it never touches a recorded run. Nor does v18 (#491, the hostile slot).
    expect(SCHEMA_VERSION).toBe(18);
    const raw = readFileSync('tests/fixtures/pre-release-v14.json', 'utf8');
    const before = JSON.parse(raw) as { legacy: { runs: Record<string, unknown>[] } };
    expect(before.legacy.runs.length).toBeGreaterThan(0);
    const loaded = deserialize(raw, CONTENT);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.legacy.runs.map((run) => run.kept)).toEqual(before.legacy.runs.map(() => null));
    expect(loaded.legacy.runs.map(({ kept: _kept, ...run }) => run)).toEqual(before.legacy.runs);
    expect(serialize(deserialize(serialize(loaded), CONTENT))).toBe(serialize(loaded));
  });

  it('refuses a carry-over the schema cannot hold', () => {
    const next = wipe({ ...fresh(), understanding: 100 }, CONTENT, 'test', 'VOLUNTARY');
    const forged = (kept: unknown) => serialize(next).replace(/"kept":\{[^}]*\}/, '"kept":' + JSON.stringify(kept));
    expect(forged({ understanding: 10, capital: 0, retentionRatio: 0.1 })).toContain('"kept":{');
    expect(() => deserialize(forged({ understanding: 10, capital: 0, retentionRatio: 1.5 }), CONTENT)).toThrow(/validation/);
    expect(() => deserialize(forged({ understanding: -1, capital: 0, retentionRatio: 0.1 }), CONTENT)).toThrow(/validation/);
    expect(() => deserialize(forged({ understanding: 10, capital: 0 }), CONTENT)).toThrow(/validation/);
  });
});
