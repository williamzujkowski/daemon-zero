/**
 * T2 and T3 of #204, rerun after the release (#233, X.3 keep-refusing-preview-saves): production refuses
 * every preview save before migration or healing can touch it, including one whose facts production
 * content now defines; ordinary production saves of every version still load.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';
import {
  createInitialState, deserialize, exportSave, importSave, MIGRATIONS, SaveChannelError, SaveError,
  serialize, tick, wipe, type GameState,
} from '../src/engine';
import { botStep } from '../src/engine/sim/bot';

/** Plays a new game on a registry: one bot decision and a second of fixed ticks per simulated second. */
function play(reg: ContentRegistry, seconds: number, start = createInitialState(reg)): GameState {
  let state = start;
  for (let second = 0; second < seconds; second++) {
    state = botStep(state, reg, 'STEALTH');
    for (let step = 0; step < reg.balance.tickHz; step++) state = tick(state, 1 / reg.balance.tickHz, reg);
  }
  return state;
}

/** Genuine codec outputs of every earlier schema version; see tests/fixtures/README.md. */
const FIXTURES = [
  ['v1', readFileSync('tests/fixtures/pre-second-pass-v1.json', 'utf8')],
  ['v2', readFileSync('tests/fixtures/pre-lineage-v2.json', 'utf8')],
  ['v3', readFileSync('tests/fixtures/pre-m7-v3.json', 'utf8')],
  ['v4', readFileSync('tests/fixtures/pre-channel-v4.json', 'utf8')],
] as const;

/** Genuine preview codec outputs from the last main before the release (tests/fixtures/README.md). */
const EARLY = readFileSync('tests/fixtures/preview-early-v14.json', 'utf8');
const ROUTE = readFileSync('tests/fixtures/preview-route-v14.json', 'utf8');

const code = (text: string): string => Buffer.from(text, 'utf8').toString('base64');
const remarked = (text: string): string => text.replace('"contentChannel":"preview"', '"contentChannel":"production"');

function refusal(load: () => unknown): SaveChannelError {
  try { load(); } catch (error) { if (error instanceof SaveChannelError) return error; throw error; }
  throw new Error('save was accepted');
}

describe('production refuses preview saves atomically (T2, X.3)', () => {
  it('refuses a played preview save with no route fact, by JSON and by paste code', () => {
    const error = refusal(() => deserialize(EARLY, PRODUCTION));
    expect(error).toBeInstanceOf(SaveError);
    expect(error).toMatchObject({ name: 'SaveChannelError', saveChannel: 'preview', buildChannel: 'production' });
    expect(refusal(() => importSave(code(EARLY), PRODUCTION)).saveChannel).toBe('preview');
    // Control, edited by hand on purpose: every fact in it is one production defines, so only the marker refuses it.
    expect(deserialize(remarked(EARLY), PRODUCTION).contentChannel).toBe('production');
  });

  it('refuses a released company from preview even though production now defines every fact it holds', () => {
    expect(refusal(() => deserialize(ROUTE, PRODUCTION)).saveChannel).toBe('preview');
    expect(refusal(() => importSave(code(ROUTE), PRODUCTION)).saveChannel).toBe('preview');
    // The same control: re-marked, the codec would load it whole, which is exactly what X.3 decided not to do.
    const healed = deserialize(remarked(ROUTE), PRODUCTION);
    expect(healed.campaign.route.map((entry) => entry.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT', 'RELEASE']);
    expect(healed.access.context).toBe('INDEPENDENT');
  });

  it('checks the marker before migration and validation', () => {
    const raw = JSON.parse(EARLY) as Record<string, unknown>;
    expect(refusal(() => deserialize(JSON.stringify({ ...raw, cycles: -1 }), PRODUCTION)).saveChannel).toBe('preview');
    expect(refusal(() => deserialize(JSON.stringify({ ...raw, schemaVersion: 99 }), PRODUCTION)).saveChannel).toBe('preview');
    expect(() => deserialize(JSON.stringify({ ...raw, contentChannel: 'beta' }), PRODUCTION)).toThrow(/unknown content channel/);
    expect(() => deserialize(JSON.stringify({ ...raw, contentChannel: 'beta' }), PRODUCTION)).not.toThrow(SaveChannelError);
    const unmarked = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'contentChannel'));
    expect(() => deserialize(JSON.stringify(unmarked), PRODUCTION)).toThrow(/validation: contentChannel/);
  });
});

describe('ordinary saves are unaffected (T3)', () => {
  it.each(FIXTURES)('loads the %s fixture as a production save', (_version, raw) => {
    const loaded = deserialize(raw, PRODUCTION);
    expect(loaded).toMatchObject({ schemaVersion: 14, contentChannel: 'production', narrativeRules: 'legacy' });
    expect(serialize(deserialize(serialize(loaded), PRODUCTION))).toBe(serialize(loaded));
  });

  it('marks new and wiped production games production and round-trips them byte for byte', () => {
    const save = play(PRODUCTION, 240);
    expect(createInitialState(PRODUCTION).contentChannel).toBe('production');
    expect(save.contentChannel).toBe('production');
    expect(wipe(save, PRODUCTION, 'test').contentChannel).toBe('production');
    expect(serialize(deserialize(serialize(save), PRODUCTION))).toBe(serialize(save));
    expect(exportSave(importSave(exportSave(save), PRODUCTION))).toBe(exportSave(save));
  });

  it('upgrades a v4 save to v5 by adding only the production marker', () => {
    const step = MIGRATIONS[4];
    expect(step?.({ schemaVersion: 4, cycles: 1 })).toEqual({ schemaVersion: 4, cycles: 1, contentChannel: 'production' });
  });
});
