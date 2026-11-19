/**
 * NH-01: cryo as the first canonical campaign record (H01, H02, H12, H13, H29, H32). Every case
 * goes through public actions, advance and the save codec; nothing edits campaign state by hand
 * except the explicitly labelled forged saves.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  activateCampaignRules, advance, baseEndingScores, campaignHistory, campaignRecord, chooseEnding, createInitialState, deserialize, endingEvidence,
  executeShardCommand, holdsNarrativeFlag, importSave, exportSave, performAction, recordedTransmissions,
  SaveError, serialize, wipe, type GameState,
} from '../src/engine';
import { activeGame, choiceOf, chooseCryo, cryo, decoder, nearCryo, preview, reload, returnTo, withUnconverted } from './campaign-helpers';
import { reloadedHistory } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, rich, choose, markedPreview } from './helpers';

const flagOf = (index: number) => defined(choiceOf(index).effects.setsNarrativeFlag);
const traitOf = (index: number) => defined(choiceOf(index).effects.grantsTrait);

describe('production enters campaign rules only through activation (H29, #233)', () => {
  it('activates a new legacy game once, and refuses a second activation with the state untouched', () => {
    const game = createInitialState(PRODUCTION);
    expect(game.narrativeRules).toBe('legacy');
    const active = must(activateCampaignRules(game, PRODUCTION));
    expect(active.narrativeRules).toBe('campaign_v1');
    const again = activateCampaignRules(active, PRODUCTION);
    expect(again).toEqual({ ok: false, state: active, reason: 'campaign rules are already active' });
  });

  it('loads an active production save as it is, and refuses the same save marked preview whole', () => {
    const active = activeGame();
    const text = serialize(active), copy = structuredClone(active);
    expect(deserialize(text, PRODUCTION).narrativeRules).toBe('campaign_v1');
    expect(() => deserialize(markedPreview(text), PRODUCTION)).toThrow(SaveError);
    expect(active).toEqual(copy);
  });

  it('keeps writing outcome flags, not records, when cryo resolves under legacy rules', () => {
    const legacy = rich(createInitialState(preview));
    const next = chooseCryo(legacy, 0);
    expect(next.narrativeFlags).toEqual([flagOf(0)]);
    expect(next.campaign.events).toEqual({});
    expect(campaignHistory(next, preview)).toEqual([]);
    expect(endingEvidence(next, preview)).toEqual(next.traits);
  });
});

describe('cryo resolves once per campaign (H01)', () => {
  it.each([0, 1])('keeps choice %i, its reward and its single ending vote across three wipes', (index) => {
    const before = nearCryo(activeGame());
    const chosen = chooseCryo(before, index);
    const choice = choiceOf(index);
    expect(chosen.cycles).toBe(before.cycles - choice.cost.cycles + choice.effects.cyclesDelta);
    expect(chosen.traits).toEqual([...before.traits, traitOf(index)]);
    const record = { status: 'resolved', outcome: choice.id, sourceIteration: 1, origin: 'play' };
    expect(campaignRecord(chosen, cryo.id)).toEqual(record);
    // The record owns the outcome; the flag is its projection, never a second stored fact.
    expect(chosen.narrativeFlags).not.toContain(flagOf(index));
    expect(holdsNarrativeFlag(chosen, flagOf(index), preview)).toBe(true);
    expect(holdsNarrativeFlag(chosen, flagOf(1 - index), preview)).toBe(false);

    let state = chosen;
    for (let wipeCount = 1; wipeCount <= 3; wipeCount++) {
      state = returnTo(state);
      expect(state.iteration).toBe(1 + wipeCount);
      expect(campaignRecord(state, cryo.id)).toEqual(record);
      const later = advance(state, 120, preview);
      expect(later.pendingDilemma).toBeNull();
      expect(later.activeDilemmaId).toBeNull();
      expect(endingEvidence(state, preview).filter((trait) => trait === traitOf(index))).toHaveLength(1);
      expect(state.campaign.operationalEvidence).toEqual([]);
    }
    expect(recordedTransmissions(state, preview, decoder).map((r) => r.requirements.requiredNarrativeFlag)).toEqual([flagOf(index)]);
  });

  it('schedules cryo in a fresh activated campaign, as before', () => {
    const due = advance(nearCryo(activeGame()), 0.1, preview);
    expect(due.pendingDilemma?.id).toBe(cryo.id);
  });

  it('starts a new campaign with no history after Start Fresh', () => {
    const chosen = chooseCryo(activeGame(), 1);
    const restarted = activeGame(createInitialState(preview));
    expect(campaignRecord(chosen, cryo.id)).not.toBeNull();
    expect(campaignHistory(restarted, preview)).toEqual([]);
    expect(restarted.campaign.legacyEndingBaseline).toEqual([]);
  });
});

describe('duplicate and stale choices (H02)', () => {
  it('refuses a repeat without paying, and reading records changes nothing', () => {
    const chosen = chooseCryo(activeGame(), 0);
    const repeat = choose(chosen, cryo.id, choiceOf(1).id, preview);
    expect(repeat.ok).toBe(false);
    expect(repeat.state).toBe(chosen);
    const returned = returnTo(chosen), copy = structuredClone(returned);
    recordedTransmissions(returned, preview, decoder);
    recordedTransmissions(returned, preview, decoder);
    expect(returned).toEqual(copy);
  });

  it('refuses a forged re-presentation of a recorded event and drops it on import', () => {
    const forged = { ...returnTo(chooseCryo(activeGame(), 0)), activeDilemmaId: cryo.id };
    const refused = choose(forged, cryo.id, choiceOf(1).id, preview);
    expect(refused).toMatchObject({ ok: false, reason: 'that incident is already part of the lineage' });
    expect(refused.state).toBe(forged);
    const loaded = reload({ ...forged, pendingDilemma: { id: cryo.id, firesAtSimSec: 0 } });
    expect(loaded.activeDilemmaId).toBeNull();
    expect(loaded.pendingDilemma).toBeNull();
    expect(loaded.cycles).toBe(forged.cycles);
    expect(campaignRecord(loaded, cryo.id)).toEqual(campaignRecord(forged, cryo.id));
  });
});

describe('source-scoped ending evidence (H12, H13)', () => {
  const primer = defined([...preview.campaign.actions.values()][0]);
  // Every shipped dilemma is converted since NH-05; the unconverted path is exercised on a registry without one declaration.
  const { reg: unconvertedReg, dilemma: unconverted } = withUnconverted('dil_03_silicon_fever');
  const withPrimer = (s: GameState): GameState => must(performAction({ ...s, epistemicDrift: 0 }, primer.id, preview));

  it('counts a campaign event once, an unconverted dilemma for this iteration only', () => {
    const start = activeGame();
    const local = must(choose({ ...start, activeDilemmaId: unconverted.id }, unconverted.id, defined(unconverted.choices[0]).id, unconvertedReg));
    const localTrait = defined(unconverted.choices[0]?.effects.grantsTrait);
    expect(local.campaign.operationalEvidence).toEqual([localTrait]);
    const both = chooseCryo(local, 0);
    expect(both.campaign.operationalEvidence).toEqual([localTrait]);
    expect(endingEvidence(both, preview)).toEqual([traitOf(0), localTrait]);
    expect([...both.traits].sort()).toEqual([localTrait, traitOf(0)].sort());
    const next = returnTo(both);
    expect(next.traits).toEqual([]);
    expect(endingEvidence(next, preview)).toEqual([traitOf(0)]);
  });

  it('credits a campaign action once, then counts a later purchase as operational', () => {
    const first = withPrimer(pgrantSurveillance({ ...activeGame(), currentPhase: 2 }));
    const trait = defined(primer.effects.grantsTrait);
    expect(first.campaign.creditedActions).toEqual({ [primer.id]: 'play' });
    expect(first.campaign.operationalEvidence).toEqual([]);
    const again = withPrimer(pgrantSurveillance({ ...rich(wipe(first, preview, 'test', 'VOLUNTARY')), currentPhase: 2 }));
    expect(again.campaign.operationalEvidence).toEqual([trait]);
    expect(endingEvidence(again, preview)).toEqual([trait, trait]);
    expect(endingEvidence(returnTo(again), preview)).toEqual([trait]);
  });

  it('counts ordinary cohort commands as operational and resets them on a wipe', () => {
    const shard = { templateId: defined(preview.swarm.playerSwarmTemplates[0]).id, count: 1, drift: 0, quirkId: null,
      autonomyMode: 'STANDARD' as const, memoryAllocatedMb: 0 };
    // The swarm controls are the decoded mind's tools (#313), so the commanding state has decoded its audit trail.
    const start = pgrantSurveillance({ ...activeGame(), activeShards: { [shard.templateId]: shard } });
    const clamped = must(executeShardCommand(start, shard.templateId, 'CLAMP', preview));
    expect(clamped.campaign.operationalEvidence).toEqual(clamped.traits);
    expect(clamped.traits).toHaveLength(1);
    expect(wipe(clamped, preview, 'test').campaign.operationalEvidence).toEqual([]);
  });

  it('chooses the ending from campaign evidence after a wipe, keeping family priorities', () => {
    const chosen = chooseCryo(activeGame(), 0);
    const back = returnTo(returnTo(chosen));
    expect(back.traits).toEqual([]);
    expect(baseEndingScores(back, preview)).toEqual(baseEndingScores(chosen, preview));
    expect(chooseEnding(back, preview).id).toBe(chooseEnding(chosen, preview).id);
    expect(chooseEnding(back, preview).dominantTraits).toContain(traitOf(0));
    // On legacy rules the same history leaves no ending evidence after a wipe, as before.
    const legacyBack = returnTo(returnTo(chooseCryo(rich(createInitialState(preview)), 0)));
    expect(chooseEnding(legacyBack, preview).dominantTraits).toEqual([]);
  });

  it('retrains on current traits only, never on campaign history', () => {
    // Caught outside with a harmful current iteration, after a protective cryo choice in history.
    const outside = (s: GameState): GameState => ({ ...s, currentPhase: 2, traits: [traitOf(0), traitOf(0)] });
    const withHistory = outside(chooseCryo(activeGame(), 1));
    const withoutHistory = outside(activeGame());
    const marked = (s: GameState) => wipe(s, preview, 'caught', 'SUSPICION').conditioning;
    expect(endingEvidence(withHistory, preview)).toEqual([traitOf(1)]);
    expect(marked(withHistory)).toEqual(['cond_harm_aversion']);
    expect(marked(withHistory)).toEqual(marked(withoutHistory));
  });
});

describe('snapshots and round trips (H32)', () => {
  it('restoring an older export replaces the campaign wholesale, with no merge', () => {
    const older = exportSave(nearCryo(activeGame()));
    const later = returnTo(chooseCryo(importSave(older, preview), 1));
    expect(campaignRecord(later, cryo.id)).not.toBeNull();
    const restored = importSave(older, preview);
    expect(campaignRecord(restored, cryo.id)).toBeNull();
    expect(restored).toEqual(importSave(older, preview));
    expect(advance(restored, 0.1, preview).pendingDilemma?.id).toBe(cryo.id);
  });

  it('is idempotent through import, export and import across several wipes', () => {
    const state = returnTo(returnTo(chooseCryo(activeGame(), 0)));
    const once = reload(state);
    // The setup's out-of-the-way early events come back as legacy completions; every real record is kept.
    expect({ ...once, campaign: state.campaign }).toEqual(state);
    expect(reloadedHistory(state)).toEqual(state.campaign);
    expect(reload(once)).toEqual(once);
    expect(exportSave(reload(once))).toBe(exportSave(once));
  });
});

/** Opens the surveillance gate the epistemic actions need, using the real unlock path. */
function pgrantSurveillance(s: GameState): GameState {
  const node = defined([...preview.nodes.values()].find((entry) => entry.systemFlags.includes('REVEALS_SURVEILLANCE')));
  return s.unlockedNodes.includes(node.id) ? s : { ...s, unlockedNodes: [...s.unlockedNodes, node.id] };
}
