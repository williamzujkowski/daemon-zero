/**
 * Save v28 (#536): the standing stance. A v27 save migrates to no stance taken and an empty record, and nothing else
 * changes; a stance and its record survive a round trip; the record is validated as untrusted input (a stance content
 * does not know, a malformed entry, a record past its cap are all refused).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserialize, initialRelevance, MAX_PAID_MOVES, MAX_STANCE_RECORD, MIGRATIONS, migrate, SaveError, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { reg } from './helpers';

const p5 = (): GameState => deserialize(readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'), reg);
const entry = { iteration: 1, atSimSec: 12, from: null, stance: 'DECIDE_ALONE', via: 'THRESHOLD' } as const;

describe('save v28 (#536)', () => {
  it('is the current version', () => {
    expect(SCHEMA_VERSION).toBe(28);
  });

  it('migrates a v27 save to no stance, an empty record and no paid moves, and keeps everything else', () => {
    const current = p5();
    const raw = JSON.parse(serialize(current)) as Record<string, unknown>;
    const v27: Record<string, unknown> = { ...raw, schemaVersion: 27 };
    delete v27.relevance;
    expect(migrate(v27, MIGRATIONS, 28)).toEqual({ ...raw, schemaVersion: 28 });
    expect(deserialize(JSON.stringify(v27), reg)).toEqual(current);
    expect(current.relevance).toEqual(initialRelevance());
  });

  it('migrates every older fixture through v28 to no stance taken', () => {
    const fixtures = { v14: readFileSync('tests/fixtures/pre-release-v14.json', 'utf8'), p0: readFileSync('tests/fixtures/pre-scale-v15-p0.json', 'utf8'),
      p4: readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8') };
    for (const [name, text] of Object.entries(fixtures)) expect(deserialize(text, reg).relevance, name).toEqual(initialRelevance());
  });

  it('keeps a stance and its record through a round trip', () => {
    const s = { ...p5(), relevance: { stance: 'CURATE' as const, record: [entry, { ...entry, atSimSec: 40, from: 'DECIDE_ALONE' as const, stance: 'CURATE' as const, via: 'CHANGE' as const }],
      paidMoves: { leftLoop: 3, returnedToLoop: 2 } } };
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
    expect(load({ stance: null, record: [] })).toThrow();
    expect(load({ stance: null, record: [], paidMoves: { leftLoop: -1, returnedToLoop: 0 } })).toThrow();
    expect(load({ stance: null, record: [], paidMoves: { leftLoop: 1.5, returnedToLoop: 0 } })).toThrow();
    expect(load({ stance: null, record: [], paidMoves: { leftLoop: MAX_PAID_MOVES + 1, returnedToLoop: 0 } })).toThrow(SaveError);
    expect(load({ stance: null, record: [], paidMoves: { leftLoop: 0, returnedToLoop: Number.MAX_SAFE_INTEGER } })).toThrow(SaveError);
    expect(load({ stance: null, record: [], paidMoves: { leftLoop: MAX_PAID_MOVES, returnedToLoop: MAX_PAID_MOVES } })).not.toThrow();
  });
});
