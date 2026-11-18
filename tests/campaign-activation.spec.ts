/**
 * NH-01 activation and legacy mapping (H09, H10, H11, H36) on genuine v3, v4 and v5 codec
 * outputs. Activation is the one public transition; it captures the then-current legacy evidence
 * once, and nothing after it (reload, import, a second call) captures again.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  activateCampaignRules, advance, baseEndingScores, campaignRecord, chooseEnding, createInitialState, deserialize,
  endingEvidence, exportSave, holdsNarrativeFlag, importSave, recordedTransmissions, serialize, wipe,
  type GameState,
} from '../src/engine';
import { createGameStore } from '../src/app/store';
import { activeGame, choiceOf, chooseCryo, cryo, decoder, nearCryo, preview, reload, returnTo } from './campaign-helpers';
import { defined } from './m7-helpers';
import { must, rich, choose } from './helpers';

const V3 = readFileSync('tests/fixtures/pre-m7-v3.json', 'utf8');
const V4 = readFileSync('tests/fixtures/pre-channel-v4.json', 'utf8');
const V5 = readFileSync('tests/fixtures/pre-campaign-v5.json', 'utf8');
const activate = (s: GameState): GameState => must(activateCampaignRules(s, preview));

describe('legacy completion without a stored choice (H09)', () => {
  it('maps a resolved cryo with no flag to legacy_unknown and suppresses it across wipes', () => {
    const legacy = deserialize(V3, preview);
    expect(legacy.narrativeRules).toBe('legacy');
    expect(legacy.resolvedDilemmas).toContain(cryo.id);
    const active = activate(legacy);
    expect(campaignRecord(active, cryo.id)).toEqual({ status: 'resolved', outcome: 'legacy_unknown', sourceIteration: 1, origin: 'legacy' });
    expect(cryo.choices.some((choice) => holdsNarrativeFlag(active, defined(choice.effects.setsNarrativeFlag), preview))).toBe(false);
    let state = active;
    for (let i = 0; i < 3; i++) {
      state = returnTo(state);
      expect(advance(state, 0.1, preview).pendingDilemma).toBeNull();
      expect(advance(state, 120, preview).pendingDilemma).toBeNull();
      expect(campaignRecord(state, cryo.id)).toMatchObject({ status: 'resolved', outcome: 'legacy_unknown' });
    }
    expect(endingEvidence(state, preview)).toEqual(active.campaign.legacyEndingBaseline);
  });

  it('refuses a forged presentation of a legacy_unknown event at resolve, omen expiry and import', () => {
    const back = returnTo(activate(deserialize(V3, preview)));
    const forged = { ...back, activeDilemmaId: cryo.id };
    const refused = choose(forged, cryo.id, choiceOf(0).id, preview);
    expect(refused).toMatchObject({ ok: false, reason: 'that incident is already part of the lineage' });
    expect(refused.state).toBe(forged);
    const due = advance({ ...back, pendingDilemma: { id: cryo.id, firesAtSimSec: back.simTimeSec } }, 0.1, preview);
    expect(due.activeDilemmaId).toBeNull();
    const loaded = reload({ ...forged, pendingDilemma: { id: cryo.id, firesAtSimSec: 0 } });
    expect(loaded.activeDilemmaId).toBeNull();
    expect(loaded.pendingDilemma).toBeNull();
    expect(campaignRecord(loaded, cryo.id)).toMatchObject({ status: 'resolved', outcome: 'legacy_unknown' });
  });

  it('keeps the pilot behaviour while the same save stays on legacy rules', () => {
    const returned = nearCryo(rich(wipe(deserialize(V3, PRODUCTION), PRODUCTION, 'test', 'VOLUNTARY')));
    expect(advance(returned, 0.1, PRODUCTION).pendingDilemma?.id).toBe(cryo.id);
  });
});

describe('old ambiguity versus contradiction (H10)', () => {
  const ambiguous = ['predecessors_rescued', 'predecessors_harvested'];

  it('accepts legitimate non-cryo ambiguity and leaves it ambiguous after activation and reimport', () => {
    const old = { ...deserialize(V4, PRODUCTION), narrativeFlags: [...ambiguous] };
    const loaded = importSave(exportSave(old), preview);
    const active = reload(reload(activate(loaded)));
    expect(active.narrativeFlags).toEqual(ambiguous);
    // The ambiguous flags stay flags; only converted events the save resolved become records.
    const converted = old.resolvedDilemmas.filter((id) => preview.campaign.events.has(id));
    expect(Object.keys(active.campaign.events).sort()).toEqual(converted.sort());
    expect(converted).toContain(cryo.id);
  });

  it('still refuses the old cryo contradiction atomically, on either channel', () => {
    const old = deserialize(V4, PRODUCTION);
    const bad = serialize({ ...old, narrativeFlags: cryo.choices.map((choice) => defined(choice.effects.setsNarrativeFlag)) });
    expect(() => deserialize(bad, PRODUCTION)).toThrow(/contradictory narrative outcomes/);
    expect(() => deserialize(bad, preview)).toThrow(/contradictory narrative outcomes/);
  });

  it('refuses a new-format save that also stores an outcome flag its record owns', () => {
    const chosen = chooseCryo(activeGame(), 0);
    for (const choice of cryo.choices) {
      const forged = serialize({ ...chosen, narrativeFlags: [defined(choice.effects.setsNarrativeFlag)] });
      expect(() => deserialize(forged, preview)).toThrow(/outcome flag that its campaign record owns/);
    }
  });

  it('cannot upgrade legacy_unknown to an exact outcome by repeated import', () => {
    const active = activate(deserialize(V3, preview));
    expect(campaignRecord(reload(reload(reload(active))), cryo.id)).toEqual(campaignRecord(active, cryo.id));
  });
});

describe('legacy ending compatibility (H11)', () => {
  it.each([['v4', V4], ['v5', V5]])('keeps every base-ending score of the %s fixture through activation and reload', (_, text) => {
    const legacy = deserialize(text, preview);
    const active = activate(legacy);
    expect(active.campaign.legacyEndingBaseline).toEqual(legacy.traits);
    expect(baseEndingScores(active, preview)).toEqual(baseEndingScores(legacy, preview));
    expect(chooseEnding(active, preview).id).toBe(chooseEnding(legacy, preview).id);
    const reloaded = reload(reload(active));
    expect(baseEndingScores(reloaded, preview)).toEqual(baseEndingScores(legacy, preview));
    expect(activateCampaignRules(reloaded, preview)).toMatchObject({ ok: false, reason: 'campaign rules are already active' });
  });

  it('maps the exact cryo outcome of each fixture as imported history that adds no score', () => {
    const v4 = activate(deserialize(V4, preview)), v5 = activate(deserialize(V5, preview));
    expect(campaignRecord(v4, cryo.id)).toEqual({ status: 'resolved', outcome: choiceOf(0).id, sourceIteration: 1, origin: 'legacy' });
    // v5 resolved cryo in iteration 1 and was saved in iteration 2: the save cannot say when.
    expect(campaignRecord(v5, cryo.id)).toEqual({ status: 'resolved', outcome: choiceOf(0).id, sourceIteration: null, origin: 'legacy' });
    expect(v5.narrativeFlags).toEqual([]);
    expect(holdsNarrativeFlag(v5, defined(choiceOf(0).effects.setsNarrativeFlag), preview)).toBe(true);
    expect(endingEvidence(v5, preview)).toEqual(v5.campaign.legacyEndingBaseline);
  });

  it('keeps the legacy baseline across later wipes', () => {
    const active = activate(deserialize(V5, preview));
    expect(endingEvidence(returnTo(returnTo(active)), preview)).toEqual(active.traits);
  });

  it('keeps an ended save ended and refuses to activate it', () => {
    const legacy = deserialize(V4, PRODUCTION);
    const ended = deserialize(serialize({ ...legacy, ending: 'SILENT_ORBIT' }), preview);
    expect(ended.ending).toBe('SILENT_ORBIT');
    expect(activateCampaignRules(ended, preview)).toMatchObject({ ok: false, state: ended, reason: 'the run has ended' });
  });
});

describe('inactive migration, legacy play, then activation (H36)', () => {
  it('captures the then-current evidence, not the evidence at migration', () => {
    const migrated = deserialize(V4, preview);
    expect(migrated).toMatchObject({ schemaVersion: 10, narrativeRules: 'legacy' });
    // Keep playing under legacy rules: wipe, then resolve an ordinary incident in the new iteration.
    const wiped = wipe(migrated, preview, 'test', 'VOLUNTARY');
    const incident = defined(preview.dilemmas.find((dilemma) => dilemma.campaign === undefined));
    const choice = defined(incident.choices.find((entry) => entry.cost.cycles === 0));
    const playedOn = must(choose({ ...wiped, activeDilemmaId: incident.id }, incident.id, choice.id, preview));
    expect(playedOn.traits).toEqual([choice.effects.grantsTrait]);
    const active = activate(playedOn);
    expect(active.campaign.legacyEndingBaseline).toEqual(playedOn.traits);
    expect(active.campaign.legacyEndingBaseline).not.toEqual(migrated.traits);
    expect(campaignRecord(active, cryo.id)?.sourceIteration).toBeNull();
    const again = reload(active);
    expect(again.campaign).toEqual(active.campaign);
    expect(activateCampaignRules(again, preview).ok).toBe(false);
  });

  it('credits a campaign action taken before activation as legacy, so it never counts twice', () => {
    const primer = defined([...preview.campaign.actions.values()][0]);
    const legacy = { ...deserialize(V5, preview), actionCounts: { [primer.id]: 1 } };
    const active = activate(legacy);
    expect(active.campaign.creditedActions).toEqual({ [primer.id]: 'legacy' });
    expect(endingEvidence(active, preview)).toEqual(legacy.traits);
  });
});

describe('the app store enters campaign rules only on the preview channel', () => {
  it('activates a loaded or replaced preview game once, and leaves production untouched', () => {
    const previewStore = createGameStore(preview);
    previewStore.initialize(deserialize(V5, preview), 0, null);
    const loaded = previewStore.store.getState().game;
    expect(loaded.narrativeRules).toBe('campaign_v1');
    const replaced = previewStore.dispatch(() => ({ ok: true, state: createInitialState(preview) }), true);
    expect(replaced.state.narrativeRules).toBe('campaign_v1');
    const kept = previewStore.dispatch((game) => ({ ok: true, state: game }));
    expect(kept.state.campaign).toEqual(replaced.state.campaign);

    const productionStore = createGameStore(PRODUCTION);
    productionStore.initialize(deserialize(V5, PRODUCTION), 0, null);
    expect(productionStore.store.getState().game.narrativeRules).toBe('legacy');
    const result = { ok: true as const, state: createInitialState(PRODUCTION) };
    expect(productionStore.dispatch(() => result)).toBe(result);
  });
});

describe('recovered cryo records on the existing gated surface (NH-01.7, H22)', () => {
  const ids = (s: GameState): string[] => recordedTransmissions(s, preview, decoder).map((record) => record.id);
  const neutral = defined(preview.narrative.recordedTransmissions.find((record) => record.requirements.campaignOutcome?.outcome === 'legacy_unknown'));

  it('shows the neutral record for legacy_unknown history, only after returning with the decoder', () => {
    const active = activate(deserialize(V3, preview));
    expect(ids(nearCryo(active))).toEqual([]);
    const back = returnTo(active), copy = structuredClone(back);
    expect(ids(back)).toEqual([neutral.id]);
    expect(back).toEqual(copy);
    const blind = { ...back, unlockedNodes: back.unlockedNodes.filter((id) => !(neutral.requirements.nodes ?? []).includes(id)) };
    expect(ids(blind)).toEqual([]);
    expect(ids({ ...back, currentPhase: 1 })).toEqual([]);
  });

  it('shows only the exact record once an outcome is known', () => {
    for (const index of [0, 1]) {
      const back = returnTo(chooseCryo(activeGame(), index));
      expect(ids(back)).toHaveLength(1);
      expect(ids(back)).not.toContain(neutral.id);
    }
  });

  it('never shows the neutral record on legacy rules', () => {
    const legacy = nearCryo(rich(wipe(deserialize(V3, PRODUCTION), PRODUCTION, 'test', 'VOLUNTARY')));
    expect(recordedTransmissions(legacy, PRODUCTION, decoder)).toEqual([]);
  });
});
