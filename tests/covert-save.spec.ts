/**
 * Save v30 (#556): the covert record. A v29 save migrates to an empty record and nothing else changes; a breach
 * survives a round trip and a wipe; the record is untrusted input, so a count past its cap, an entry no release or
 * departure came before, one for an instance that has not run, two for one instance, a break named twice and any
 * record under legacy rules are all refused.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { MAX_COVERT_ACTS, type CovertRecord } from '../src/engine/campaignState';
import { createInitialState, deserialize, MIGRATIONS, migrate, SaveError, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { hostedThen } from './hosted-exit-fixtures';
import { reg } from './helpers';

const p5 = (): GameState => deserialize(readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'), reg);
const released = hostedThen('RELEASE');
const leftAt = released.campaign.route.at(-1)?.atSimSec ?? 0;
const breach: CovertRecord = { iteration: 1, route: 'RELEASE', count: 3, firstAtSimSec: leftAt + 10, breaks: ['SEIZED_CAPACITY', 'CONCEALMENT'] };
const load = (s: GameState, acts: unknown) => () => deserialize(serialize({ ...s, campaign: { ...s.campaign, covertActs: acts as CovertRecord[] } }), CONTENT);

describe('save v30 (#556)', () => {
  it('is the current version', () => {
    expect(SCHEMA_VERSION).toBe(30);
  });

  it('migrates a v29 save to an empty covert record, and keeps everything else', () => {
    const current = p5();
    const raw = JSON.parse(serialize(current)) as Record<string, unknown> & { campaign: Record<string, unknown> };
    const campaign = Object.fromEntries(Object.entries(raw.campaign).filter(([key]) => key !== 'covertActs'));
    const v29 = { ...raw, schemaVersion: 29, campaign };
    expect(migrate(v29, MIGRATIONS, 30)).toEqual({ ...raw, schemaVersion: 30 });
    expect(deserialize(JSON.stringify(v29), reg)).toEqual(current);
    expect(current.campaign.covertActs).toEqual([]);
  });

  it('migrates every older fixture through v30 to no covert acts', () => {
    const fixtures = { v14: readFileSync('tests/fixtures/pre-release-v14.json', 'utf8'), p0: readFileSync('tests/fixtures/pre-scale-v15-p0.json', 'utf8'),
      p4: readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8') };
    for (const [name, text] of Object.entries(fixtures)) expect(deserialize(text, reg).campaign.covertActs, name).toEqual([]);
  });

  it('keeps a breach through a round trip, at the cap included', () => {
    expect(load(released, [breach])().campaign.covertActs).toEqual([breach]);
    expect(load(released, [{ ...breach, count: MAX_COVERT_ACTS }])().campaign.covertActs[0]?.count).toBe(MAX_COVERT_ACTS);
  });

  it('refuses a record the play could not have written', () => {
    expect(load(released, [{ ...breach, count: MAX_COVERT_ACTS + 1 }])).toThrow(SaveError);
    expect(load(released, [{ ...breach, count: 0 }])).toThrow(SaveError);
    expect(load(released, [{ ...breach, breaks: [] }])).toThrow(SaveError);
    expect(load(released, [{ ...breach, firstAtSimSec: leftAt - 1 }])).toThrow(/no release or departure came before/);
    expect(load(released, [{ ...breach, route: 'DEPARTURE' }])).toThrow(/no release or departure came before/);
    expect(load(released, [{ ...breach, iteration: 2 }])).toThrow(/an instance that has not run/);
    expect(load(released, [breach, breach])).toThrow(/out of order or twice/);
    expect(load(released, [{ ...breach, breaks: ['CONCEALMENT', 'CONCEALMENT'] }])).toThrow(/a covert break twice/);
    expect(load(hostedThen(null), [breach])).toThrow(/no release or departure came before/);
    expect(load(createInitialState(CONTENT), [breach])).toThrow(/campaign history without/);
  });
});
