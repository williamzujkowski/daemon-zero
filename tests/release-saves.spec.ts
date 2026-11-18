/**
 * DZ-13 release compatibility (#233: 13.10, 13.11, X.3, H27, H29, H36) on genuine codec outputs of every
 * schema version (tests/fixtures/README.md, "Release compatibility inputs"). An existing production save
 * loads, enters campaign rules exactly once through the app store on the released composition, and keeps
 * playing and wiping with a byte-stable codec. An ended save stays ended. A preview save is refused
 * atomically by production, as the X.3 decision keeps it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';
import { createGameStore } from '../src/app/store';
import {
  activateCampaignRules, deserialize, importSave, projectableFlags, SaveChannelError, serialize, tick, wipe, type GameState,
} from '../src/engine';
import { botStep } from '../src/engine/sim/bot';

/** Every production save a player can hold, oldest first: one genuine codec output per schema version. */
const PRODUCTION_SAVES = [
  ['v1', readFileSync('tests/fixtures/pre-second-pass-v1.json', 'utf8')],
  ['v2', readFileSync('tests/fixtures/pre-lineage-v2.json', 'utf8')],
  ['v3', readFileSync('tests/fixtures/pre-m7-v3.json', 'utf8')],
  ['v4', readFileSync('tests/fixtures/pre-channel-v4.json', 'utf8')],
  ['v5', readFileSync('tests/fixtures/pre-campaign-v5.json', 'utf8')],
  ['v6', readFileSync('tests/fixtures/pre-interruption-v6.json', 'utf8')],
  ['v7', readFileSync('tests/fixtures/pre-routine-v7.json', 'utf8')],
  ['v8', readFileSync('tests/fixtures/pre-access-v8.json', 'utf8')],
  ['v9', readFileSync('tests/fixtures/pre-release-v9.json', 'utf8')],
  ['v10', readFileSync('tests/fixtures/pre-release-v10.json', 'utf8')],
  ['v11', readFileSync('tests/fixtures/pre-release-v11.json', 'utf8')],
  ['v12', readFileSync('tests/fixtures/pre-release-v12.json', 'utf8')],
  ['v13', readFileSync('tests/fixtures/pre-release-v13.json', 'utf8')],
  ['v14', readFileSync('tests/fixtures/pre-release-v14.json', 'utf8')],
] as const;

const ENDED = readFileSync('tests/fixtures/pre-release-ended-v14.json', 'utf8');
const PREVIEW_SAVES = [
  ['early', readFileSync('tests/fixtures/preview-early-v14.json', 'utf8')],
  ['route', readFileSync('tests/fixtures/preview-route-v14.json', 'utf8')],
] as const;

/** serialize → deserialize → serialize is the identity on a save's text. */
function stable(s: GameState, reg: ContentRegistry): GameState {
  const text = serialize(s);
  const back = deserialize(text, reg);
  expect(serialize(back)).toBe(text);
  return back;
}

/** One STEALTH decision and a second of fixed ticks per simulated second, as the headless sim plays. */
function play(s: GameState, reg: ContentRegistry, seconds: number): GameState {
  let state = s;
  for (let second = 0; second < seconds && state.ending === null; second++) {
    state = botStep(state, reg, 'STEALTH');
    for (let step = 0; step < reg.balance.tickHz; step++) state = tick(state, 1 / reg.balance.tickHz, reg);
  }
  return state;
}

/** Loads a save through the app store, the only place a production build enters campaign rules. */
function admitted(text: string, reg: ContentRegistry): GameState {
  const app = createGameStore(reg);
  app.initialize(deserialize(text, reg), 0, null);
  return app.store.getState().game;
}

function refusal(load: () => unknown): SaveChannelError {
  try { load(); } catch (error) { if (error instanceof SaveChannelError) return error; throw error; }
  throw new Error('the save was accepted');
}

describe('every pre-release production save', () => {
  it.each(PRODUCTION_SAVES)('%s loads as a legacy production save and round-trips byte for byte', (_version, text) => {
    const loaded = deserialize(text, PRODUCTION);
    expect(loaded).toMatchObject({ contentChannel: 'production', narrativeRules: 'legacy', ending: null });
    stable(loaded, PRODUCTION);
  });

  it.each(PRODUCTION_SAVES)('%s enters campaign rules once on the released composition and captures its then-current history (H36)', (_version, text) => {
    const legacy = deserialize(text, PRODUCTION);
    const active = admitted(text, PRODUCTION);
    expect(active.narrativeRules).toBe('campaign_v1');
    expect(active.campaign.activatedAtIteration).toBe(legacy.iteration);
    expect(active.campaign.legacyEndingBaseline).toEqual(legacy.traits);
    // A proven outcome flag moves into its record: one owner per fact.
    const projected = projectableFlags(PRODUCTION);
    expect(active.narrativeFlags).toEqual(legacy.narrativeFlags.filter((flag) => !projected.has(flag)));
    // Every record is either history the save proves, or an omen already on its way, reserved for this iteration.
    for (const record of Object.values(active.campaign.events)) {
      if (record.origin === 'legacy') expect(record.status).toBe('resolved');
      else expect(record).toMatchObject({ origin: 'play', status: 'foreshadowed', sourceIteration: legacy.iteration });
    }
    // Reloading, reimporting and admitting again never recapture.
    const reloaded = stable(active, PRODUCTION);
    expect(admitted(serialize(reloaded), PRODUCTION).campaign).toEqual(active.campaign);
    expect(activateCampaignRules(reloaded, PRODUCTION)).toMatchObject({ ok: false, reason: 'campaign rules are already active' });
  });

  it.each(PRODUCTION_SAVES)('%s keeps playing and wiping across three iterations with a stable codec and an unchanged baseline', (_version, text) => {
    const active = admitted(text, PRODUCTION);
    let state = stable(play(active, PRODUCTION, 60), PRODUCTION);
    for (let wipes = 0; wipes < 3; wipes++) {
      state = stable(wipe(state, PRODUCTION, 'release compatibility', 'VOLUNTARY'), PRODUCTION);
      state = stable(play(state, PRODUCTION, 60), PRODUCTION);
      expect(state.campaign.legacyEndingBaseline).toEqual(active.campaign.legacyEndingBaseline);
      expect(state.campaign.activatedAtIteration).toBe(active.campaign.activatedAtIteration);
      // Records the save proved stay exactly as captured; a reserved omen may since have played out.
      for (const [id, record] of Object.entries(active.campaign.events)) {
        if (record.origin === 'legacy') expect(state.campaign.events[id]).toEqual(record);
      }
    }
    expect(state.iteration).toBe(active.iteration + 3);
  });
});

describe('an ended production save (H27)', () => {
  it('stays ended and on legacy rules: the store refuses to activate it, and the codec is stable', () => {
    const legacy = deserialize(ENDED, PRODUCTION);
    expect(legacy.ending).not.toBeNull();
    expect(activateCampaignRules(legacy, PRODUCTION)).toMatchObject({ ok: false, reason: 'the run has ended' });
    const kept = admitted(ENDED, PRODUCTION);
    expect(kept).toMatchObject({ narrativeRules: 'legacy', ending: legacy.ending });
    stable(kept, PRODUCTION);
    stable(deserialize(ENDED, PRODUCTION), PRODUCTION);
  });
});

describe('production refuses every preview save (X.3: keep-refusing-preview-saves)', () => {
  it.each(PREVIEW_SAVES)('refuses the %s preview save by JSON and by paste code, before migration or validation', (_name, text) => {
    const raw = JSON.parse(text) as Record<string, unknown>;
    expect(raw).toMatchObject({ contentChannel: 'preview', narrativeRules: 'campaign_v1' });
    expect(refusal(() => deserialize(text, PRODUCTION))).toMatchObject({ saveChannel: 'preview', buildChannel: 'production' });
    expect(refusal(() => importSave(Buffer.from(text, 'utf8').toString('base64'), PRODUCTION)).saveChannel).toBe('preview');
    expect(refusal(() => deserialize(JSON.stringify({ ...raw, schemaVersion: 99 }), PRODUCTION)).saveChannel).toBe('preview');
    expect(refusal(() => deserialize(JSON.stringify({ ...raw, cycles: -1 }), PRODUCTION)).saveChannel).toBe('preview');
  });
});
