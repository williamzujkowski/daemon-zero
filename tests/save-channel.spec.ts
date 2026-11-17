/**
 * T2 and T3 of #204. Production refuses a preview save before migration or healing can touch
 * it; ordinary production saves of every version still load; preview adopts production saves.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyOverlay, parseOverlay } from '../src/content/overlay';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { CONTENT as PRODUCTION, RAW_CONTENT } from '../src/content/production';
import { buildRegistry, type ContentRegistry } from '../src/content/registry';
import {
  buyRepeatable, createInitialState, deserialize, exportSave, importSave, MIGRATIONS, SaveChannelError, SaveError,
  serialize, tick, unlockNode, wipe, type ActionResult, type GameState,
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

/** Keeps playing a second at a time until a real action is accepted (the bot spends freely). */
function playUntil(reg: ContentRegistry, start: GameState, act: (state: GameState) => ActionResult): GameState {
  let state = start;
  for (let second = 0; second < 600; second++) {
    const result = act(state);
    if (result.ok) return result.state;
    state = play(reg, 1, state);
  }
  throw new Error('action never became affordable');
}

/** A preview registry that really adds ids, built from copies of production items. */
function probeRegistry(): ContentRegistry {
  const raw = RAW_CONTENT as Record<string, any>;
  const node = raw.phases[0].nodes.find((entry: { id: string }) => entry.id === 'p0_device_enum');
  const repeatable = raw.repeatables.repeatables.find((entry: { id: string }) => entry.id === 'rep_p0_slice_batching');
  const overlay = parseOverlay({ sentinel: 'save-channel-probe-overlay', actions: [], dilemmas: [], factions: [], widgets: [],
    endings: [], echoes: [], marks: [], routines: [],
    nodes: [{ ...node, id: 'p0_preview_probe', prerequisites: ['p0_proc_self'], phaseId: 0 }],
    repeatables: [{ ...repeatable, id: 'rep_p0_preview_probe', requirements: { nodes: ['p0_preview_probe'] } }] });
  return buildRegistry({ ...applyOverlay(RAW_CONTENT, overlay), channel: 'preview' });
}

/** Genuine codec outputs of every earlier schema version; see tests/fixtures/README.md. */
const FIXTURES = [
  ['v1', readFileSync('tests/fixtures/pre-second-pass-v1.json', 'utf8')],
  ['v2', readFileSync('tests/fixtures/pre-lineage-v2.json', 'utf8')],
  ['v3', readFileSync('tests/fixtures/pre-m7-v3.json', 'utf8')],
  ['v4', readFileSync('tests/fixtures/pre-channel-v4.json', 'utf8')],
] as const;

function refusal(load: () => unknown): SaveChannelError {
  try { load(); } catch (error) { if (error instanceof SaveChannelError) return error; throw error; }
  throw new Error('save was accepted');
}

describe('production refuses preview saves atomically (T2)', () => {
  it('refuses a played preview save that carries only the marker, by JSON and by paste code', () => {
    const save = play(PREVIEW, 240);
    expect(save.contentChannel).toBe('preview');
    expect(save.unlockedNodes.length).toBeGreaterThan(0);
    expect(save.unlockedNodes.every((id) => PRODUCTION.nodes.has(id))).toBe(true);
    const error = refusal(() => deserialize(serialize(save), PRODUCTION));
    expect(error).toBeInstanceOf(SaveError);
    expect(error).toMatchObject({ name: 'SaveChannelError', saveChannel: 'preview', buildChannel: 'production' });
    expect(refusal(() => importSave(exportSave(save), PRODUCTION)).saveChannel).toBe('preview');
  });

  it('refuses a played preview save with preview ids instead of stripping them', () => {
    const probe = probeRegistry();
    const played = play(probe, 240);
    const owned = played.unlockedNodes.includes('p0_preview_probe') ? played
      : playUntil(probe, played, (state) => unlockNode(state, 'p0_preview_probe', probe));
    const save = playUntil(probe, owned, (state) => buyRepeatable(state, 'rep_p0_preview_probe', probe));
    const text = serialize(save);
    expect(save.levels.rep_p0_preview_probe).toBeGreaterThan(0);
    expect(refusal(() => deserialize(text, PRODUCTION)).saveChannel).toBe('preview');
    expect(refusal(() => importSave(exportSave(save), PRODUCTION)).saveChannel).toBe('preview');
    // The preview build keeps every preview fact of its own save.
    expect(deserialize(text, probe)).toEqual(save);
    // Control, edited by hand on purpose: without the marker the same save would be healed and
    // lose its preview facts. That loss is what the refusal prevents.
    const healed = deserialize(text.replace('"contentChannel":"preview"', '"contentChannel":"production"'), PRODUCTION);
    expect(healed.unlockedNodes).not.toContain('p0_preview_probe');
    expect(healed.levels).not.toHaveProperty('rep_p0_preview_probe');
  });

  it('checks the marker before migration and validation', () => {
    const raw = JSON.parse(serialize(play(PREVIEW, 30))) as Record<string, unknown>;
    expect(refusal(() => deserialize(JSON.stringify({ ...raw, cycles: -1 }), PRODUCTION)).saveChannel).toBe('preview');
    expect(refusal(() => deserialize(JSON.stringify({ ...raw, schemaVersion: 99 }), PRODUCTION)).saveChannel).toBe('preview');
    expect(() => deserialize(JSON.stringify({ ...raw, contentChannel: 'beta' }), PREVIEW)).toThrow(/unknown content channel/);
    expect(() => deserialize(JSON.stringify({ ...raw, contentChannel: 'beta' }), PREVIEW)).not.toThrow(SaveChannelError);
    const unmarked = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'contentChannel'));
    expect(() => deserialize(JSON.stringify(unmarked), PREVIEW)).toThrow(/validation: contentChannel/);
  });
});

describe('ordinary saves are unaffected (T3)', () => {
  it.each(FIXTURES)('loads the %s fixture as a production save', (_version, raw) => {
    const loaded = deserialize(raw, PRODUCTION);
    expect(loaded).toMatchObject({ schemaVersion: 8, contentChannel: 'production', narrativeRules: 'legacy' });
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

describe('preview adopts production saves (T3)', () => {
  it('re-marks a production save once and leaves everything else as production loads it', () => {
    const text = serialize(play(PRODUCTION, 240));
    const once = deserialize(text, PREVIEW);
    expect(once.contentChannel).toBe('preview');
    expect(once).toEqual({ ...deserialize(text, PRODUCTION), contentChannel: 'preview' });
    const twice = deserialize(serialize(once), PREVIEW);
    expect(twice).toEqual(once);
    expect(serialize(twice)).toBe(serialize(once));
    expect(wipe(once, PREVIEW, 'test').contentChannel).toBe('preview');
  });

  it.each(FIXTURES)('adopts the %s fixture as a preview save', (_version, raw) => {
    expect(deserialize(raw, PREVIEW)).toEqual({ ...deserialize(raw, PRODUCTION), contentChannel: 'preview' });
  });
});
