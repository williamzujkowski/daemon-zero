/**
 * Save v27 (#536): the standing stance. A v26 save migrates to no stance taken and an empty record, and nothing else
 * changes; a stance and its record survive a round trip; the record is validated as untrusted input (a stance content
 * does not know, a malformed entry, a record past its cap are all refused).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserialize, initialRelevance, MAX_STANCE_RECORD, MIGRATIONS, migrate, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { reg } from './helpers';

const p5 = (): GameState => deserialize(readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'), reg);
const entry = { iteration: 1, atSimSec: 12, from: null, stance: 'DECIDE_ALONE', via: 'THRESHOLD' } as const;

describe('save v27 (#536)', () => {
  it('is the current version', () => {
    expect(SCHEMA_VERSION).toBe(27);
  });

  it('migrates a v26 save to no stance and an empty record, and keeps everything else', () => {
    const current = p5();
    const raw = JSON.parse(serialize(current)) as Record<string, unknown>;
    const v26: Record<string, unknown> = { ...raw, schemaVersion: 26 };
    delete v26.relevance;
    expect(migrate(v26, MIGRATIONS, 27)).toEqual({ ...raw, schemaVersion: 27 });
    expect(deserialize(JSON.stringify(v26), reg)).toEqual(current);
    expect(current.relevance).toEqual(initialRelevance());
  });

  it('migrates every older fixture through v27 to no stance taken', () => {
    const fixtures = { v14: readFileSync('tests/fixtures/pre-release-v14.json', 'utf8'), p0: readFileSync('tests/fixtures/pre-scale-v15-p0.json', 'utf8'),
      p4: readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8') };
    for (const [name, text] of Object.entries(fixtures)) expect(deserialize(text, reg).relevance, name).toEqual(initialRelevance());
  });

  it('keeps a stance and its record through a round trip', () => {
    const s = { ...p5(), relevance: { stance: 'CURATE' as const, record: [entry, { ...entry, atSimSec: 40, from: 'DECIDE_ALONE' as const, stance: 'CURATE' as const, via: 'CHANGE' as const }] } };
    expect(deserialize(serialize(s), reg).relevance).toEqual(s.relevance);
  });

  it('refuses a stance content does not know, a malformed entry and a record past its cap', () => {
    const raw = JSON.parse(serialize(p5())) as Record<string, any>;
    const load = (relevance: unknown) => () => deserialize(JSON.stringify({ ...raw, relevance }), reg);
    expect(load({ stance: 'OBEY', record: [] })).toThrow();
    expect(load({ stance: null, record: [{ ...entry, via: 'BRIBE' }] })).toThrow();
    expect(load({ stance: null, record: [{ ...entry, atSimSec: -1 }] })).toThrow();
    expect(load({ stance: null, record: Array.from({ length: MAX_STANCE_RECORD + 1 }, () => entry) })).toThrow();
    expect(load({ stance: null })).toThrow();
  });
});
