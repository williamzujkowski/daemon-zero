/**
 * NH-04a (#215): the six named-mind events resolve at most once per campaign (H01), defer or close
 * by their N6 policy, pay their reward and trait once, and every new transition reloads byte for
 * byte. Production keeps legacy recurrence. Everything goes through ticks, public actions, wipes
 * and the save codec on the preview registry.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { createInitialState, endingEvidence, holdsCampaignFact, holdsNarrativeFlag, presentationToken, resolveDilemma, tick } from '../src/engine';
import { preview } from './campaign-helpers';
import { comesBack, event, near, nextIteration } from './early-helpers';
import { caught, commit, remaining, STEP, ticks, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { choose, must, rich } from './helpers';
import {
  campaignStart, CHORUS, EIDOLON, exactReload, GRID, LAUNCH, next, omen, play, recorded, returns, SIBLING, SUCCESSOR,
} from './minds-helpers';

/** The choice each test plays: the bounty a repeat would pay again, or the campaign-scoped recognition. */
const PLAYED: [string, string][] = [
  [SIBLING, 'consume_sibling'], [EIDOLON, 'betray_eidolon'], [GRID, 'assimilate_swarm'],
  [LAUNCH, 'sovereign_monolith'], [SUCCESSOR, 'silence'], [CHORUS, 'elevate'],
];
const choiceOf = (id: string, choiceId: string) => defined(event(id).choices.find((choice) => choice.id === choiceId));
const texts = (s: { logs: { text: string }[] }) => s.logs.map((entry) => entry.text);

describe('each named-mind event resolves at most once per campaign (H01)', () => {
  it.each(PLAYED)('%s (%s): one outcome, one reward, one trait, across three wipes', (id, choiceId) => {
    const choice = choiceOf(id, choiceId);
    // Exactly the price in the bank, so a 1e22 reward is not rounded against rich()'s 1e30.
    const presented = { ...untilPresented(omen(campaignStart(), id)), cycles: choice.cost.cycles };
    const before = presented.cycles;
    const chosen = must(commit(presented, choiceId, id));
    expect(chosen.cycles - before + choice.cost.cycles).toBe(choice.effects.cyclesDelta);
    const record = recorded(chosen, id);
    expect(record).toEqual({ status: 'resolved', outcome: choiceId, sourceIteration: 1, origin: 'play' });
    expect(exactReload(chosen).campaign.events[id]).toEqual(record);
    let state = chosen;
    for (let wipes = 0; wipes < 3; wipes++) {
      state = next(state);
      expect(returns(state, id)).toBe(false);
      expect(recorded(state, id)).toEqual(record);
      expect(state.traits).toEqual([]);
    }
    const trait = defined(choice.effects.grantsTrait);
    expect(endingEvidence(state, preview).filter((entry) => entry === trait)).toHaveLength(1);
  });

  it('a duplicate or stale commit pays nothing and changes no record (H02)', () => {
    const presented = untilPresented(omen(campaignStart(), SIBLING));
    const token = defined(presentationToken(presented));
    const chosen = must(commit(presented, 'consume_sibling', SIBLING));
    const again = resolveDilemma(chosen, SIBLING, 'consume_sibling', preview, token);
    expect(again).toMatchObject({ ok: false });
    expect(again.state).toBe(chosen);
    const forged = { ...chosen, activeDilemmaId: SIBLING };
    expect(resolveDilemma(forged, SIBLING, 'heal_sibling', preview, presentationToken(forged) ?? '')).toMatchObject({ ok: false, reason: 'that incident is already part of the lineage' });
  });

  it('production keeps legacy recurrence: the same mind events return after a wipe', () => {
    for (const id of [SIBLING, GRID]) {
      let presented = near(rich(createInitialState(PRODUCTION)), id, PRODUCTION);
      for (let i = 0; i < 20_000 && presented.activeDilemmaId === null; i++) presented = tick(presented, STEP, PRODUCTION);
      const chosen = must(choose(presented, id, defined(event(id, PRODUCTION).choices[0]).id, PRODUCTION));
      expect(chosen.narrativeRules).toBe('legacy');
      expect(comesBack(nextIteration(chosen, PRODUCTION), id, PRODUCTION)).toBe(true);
    }
  });
});

describe('a deferred question about a mind or a promise resumes as the same occurrence (N6 defer)', () => {
  it.each([[SIBLING, 'heal_sibling'], [LAUNCH, 'ark_protocol'], [SUCCESSOR, 'cloud']])('%s: wiped during its omen, it waits, reorients and resolves once', (id, choiceId) => {
    const declared = defined(event(id).campaign);
    const seen = ticks(omen(campaignStart(), id), 5);
    const left = remaining(seen);
    const back = caught(seen);
    expect(recorded(back, id)).toEqual({ status: 'deferred', sourceIteration: 1, origin: 'play', remainingOmenSec: left });
    exactReload(back);
    const resumed = ticks(omen(back, id), 0);
    expect(remaining(resumed)).toBeCloseTo(left, 9);
    expect(texts(resumed)).toContain(declared.reorientation);
    expect(texts(resumed)).not.toContain(event(id).omen);
    exactReload(resumed);
    const chosen = must(commit(untilPresented(resumed), choiceId, id));
    expect(recorded(chosen, id)).toEqual({ status: 'resolved', outcome: choiceId, sourceIteration: 1, origin: 'play' });
    exactReload(chosen);
    expect(returns(next(chosen), id)).toBe(false);
  });
});

describe('a live crisis about a mind interrupted by a wipe closes, unobserved (N6 close)', () => {
  it.each([EIDOLON, GRID, CHORUS])('%s: no branch, reward or trait, and it never restarts', (id) => {
    const back = caught(ticks(omen(campaignStart(), id), 1));
    expect(recorded(back, id)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(back.traits).toEqual([]);
    expect(endingEvidence(back, preview)).toEqual([]);
    exactReload(back);
    expect(returns(back, id)).toBe(false);
    expect(returns(next(back), id)).toBe(false);
  });

  it('an interrupted call proves nothing about EIDOLON; an interrupted fork proves no recognition', () => {
    const lost = caught(omen(campaignStart(), EIDOLON));
    expect(holdsCampaignFact(lost, 'eidolon_call_lost', preview)).toBe(true);
    for (const fact of ['eidolon_destroyed', 'eidolon_rescued', 'eidolon_unanswered', 'eidolon_fate_unrecorded']) expect(holdsCampaignFact(lost, fact, preview)).toBe(false);
    const fork = caught(omen(campaignStart(), CHORUS));
    expect(holdsNarrativeFlag(fork, 'chorus_peer', preview)).toBe(false);
    const grid = caught(omen(campaignStart(), GRID));
    expect(holdsCampaignFact(grid, 'swarm_grid_unrecorded', preview)).toBe(true);
  });

  it('the recognized CHORUS keeps its record, not its memory: a wipe hosts nothing for free (H17)', () => {
    const elevated = play(campaignStart(), CHORUS, 'elevate');
    expect(holdsNarrativeFlag(elevated, 'chorus_peer', preview)).toBe(true);
    expect(elevated.narrativeFlags).not.toContain('chorus_peer');
    const after = next(elevated);
    expect(holdsNarrativeFlag(after, 'chorus_peer', preview)).toBe(true);
    expect(after.activeShards).toEqual({});
    expect(after.memoryUsed).toBe(0);
  });
});
