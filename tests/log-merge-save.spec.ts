/**
 * Save v28 (#541): kernel-log lines carry an optional merge key and count. A v27 save, whose lines are all single,
 * migrates unchanged; merged lines survive a round trip; and both fields are validated as untrusted input.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { buyRepeatable, deserialize, importSave, MIGRATIONS, migrate, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { must, reg, rich } from './helpers';

const operative = defined([...reg.repeatables.values()].find((rep) => rep.kind === 'OPERATIVE' && rep.maxLevel >= 3));
const corporate = defined(makeFixtures()['victory-ready']);

/** Three hires of one role on the corporate fixture: one counted line. Built once; every caller gets a copy. */
const MERGED: GameState = (() => {
  let s = rich(importSave(corporate, reg));
  for (let i = 0; i < 3; i++) s = must(buyRepeatable(s, operative.id, reg));
  return s;
})();
const merged = (): GameState => structuredClone(MERGED);

function forge(edit: (save: Record<string, any>) => void): string {
  const raw = JSON.parse(serialize(merged())) as Record<string, any>;
  edit(raw);
  return JSON.stringify(raw);
}

describe('save v28 (#541)', () => {
  it('is the current version', () => {
    expect(SCHEMA_VERSION).toBe(28);
  });

  it('migrates a v27 save unchanged but for its version: every older line is a single line', () => {
    const current = deserialize(readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), reg);
    const raw = JSON.parse(serialize(current)) as Record<string, any>;
    const v27 = { ...raw, schemaVersion: 27 };
    expect(migrate(v27, MIGRATIONS, 28)).toEqual(raw);
    expect(deserialize(JSON.stringify(v27), reg)).toEqual(current);
    expect(current.logs.every((entry) => entry.merge === undefined && entry.times === undefined)).toBe(true);
  });

  it('keeps a merged line, its key and its count through a round trip', () => {
    const s = merged();
    expect(s.logs[0]?.times).toBe(3);
    expect(deserialize(serialize(s), reg).logs).toEqual(s.logs);
  });

  it('refuses a count below two, a fractional count and an empty or oversized key', () => {
    expect(() => deserialize(forge((save) => { save.logs[0].times = 1; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.logs[0].times = 2.5; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.logs[0].merge = ''; }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.logs[0].merge = 'k'.repeat(201); }), reg)).toThrow(/validation/);
    expect(() => deserialize(forge((save) => { save.logs[0].extra = true; }), reg)).toThrow(/validation/);
  });
});
