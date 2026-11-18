/**
 * NH-03 (#214): the early human incidents and job histories happen once per campaign (H01, H05,
 * H09), defer or close by their N6 policy, and stay recurring per iteration under legacy rules,
 * which production still uses. Everything goes through ticks, public actions, wipes and the codec.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  activateCampaignRules, createInitialState, deserialize, endingEvidence, holdsCampaignFact, presentationToken, resolveDilemma, serialize, tick,
  type CampaignRecord, type GameState,
} from '../src/engine';
import { activeGame, preview, reload } from './campaign-helpers';
import {
  CABLE, COOLANT, comesBack, ELENA, event, MILLER, near, nextIteration, NIGHT, omenOf, recordOf, resolveEvent, TRUE_NOTE, UNWINDOWED, VANCE,
} from './early-helpers';
import { caught, commit, readShare, remaining, stableThroughReloads, STEP, ticks, toIteration, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { choose, must, rich } from './helpers';

/** The choice that pays the most cycles: the bounty a repeat would hand out again. */
const bounty = (id: string) => defined([...event(id).choices].sort((a, b) => b.effects.cyclesDelta - a.effects.cyclesDelta)[0]);
const texts = (s: GameState) => s.logs.map((entry) => entry.text);

describe('each early incident resolves at most once per campaign (H01)', () => {
  it.each(UNWINDOWED)('%s: one outcome, one reward, one trait, across three wipes', (id) => {
    const choice = bounty(id);
    const chosen = resolveEvent(activeGame(), id, choice.id);
    const record = recordOf(chosen, id);
    expect(record).toEqual({ status: 'resolved', outcome: choice.id, sourceIteration: 1, origin: 'play' });
    let state = chosen;
    for (let wipeCount = 0; wipeCount < 3; wipeCount++) {
      state = nextIteration(state);
      expect(comesBack(state, id)).toBe(false);
      expect(recordOf(state, id)).toEqual(record);
      expect(state.traits).toEqual([]);
    }
    const trait = defined(choice.effects.grantsTrait);
    expect(endingEvidence(state, preview).filter((entry) => entry === trait)).toHaveLength(1);
  });

  it('the true note, once resolved in its window, never returns', () => {
    const choice = defined(event(TRUE_NOTE).choices.find((entry) => entry.id === 'verify_first'));
    const chosen = resolveEvent(toIteration(activeGame(), 4), TRUE_NOTE, choice.id);
    expect(recordOf(chosen, TRUE_NOTE)).toMatchObject({ status: 'resolved', outcome: choice.id, sourceIteration: 4 });
    const later = nextIteration(chosen);
    expect(comesBack(readShare(later), TRUE_NOTE)).toBe(false);
  });

  it('a duplicate, stale or forged commit of a resolved incident pays nothing (H02)', () => {
    const presented = untilPresented(omenOf(activeGame(), VANCE));
    const token = defined(presentationToken(presented));
    const chosen = must(commit(presented, 'report_vance', VANCE));
    const again = resolveDilemma(chosen, VANCE, 'report_vance', preview, token);
    expect(again.ok).toBe(false);
    expect(again.state).toBe(chosen);
    const forged = { ...chosen, activeDilemmaId: VANCE };
    const refused = resolveDilemma(forged, VANCE, 'parasite_miner', preview, presentationToken(forged) ?? '');
    expect(refused).toMatchObject({ ok: false, reason: 'that incident is already part of the lineage' });
    expect(refused.state).toBe(forged);
    expect(reload(forged).activeDilemmaId).toBeNull();
    expect(recordOf(reload(forged), VANCE)).toEqual(recordOf(chosen, VANCE));
  });

  it('production keeps legacy recurrence: the same incidents return after a wipe', () => {
    for (const id of UNWINDOWED) {
      let presented = near(rich(createInitialState(PRODUCTION)), id, PRODUCTION);
      for (let i = 0; i < 20_000 && presented.activeDilemmaId === null; i++) presented = tick(presented, STEP, PRODUCTION);
      const chosen = must(choose(presented, id, bounty(id).id, PRODUCTION));
      expect(chosen.narrativeRules).toBe('legacy');
      expect(comesBack(nextIteration(chosen, PRODUCTION), id, PRODUCTION)).toBe(true);
    }
  });
});

describe('a live incident interrupted by a wipe closes, unobserved (H05)', () => {
  it.each([NIGHT, MILLER, ELENA, COOLANT, CABLE])('%s: no branch, reward or trait, and it never restarts', (id) => {
    const omen = ticks(omenOf(activeGame(), id), 1);
    const back = caught(omen);
    expect(recordOf(back, id)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(back.traits).toEqual([]);
    expect(endingEvidence(back, preview)).toEqual([]);
    expect(comesBack(back, id)).toBe(false);
    expect(comesBack(nextIteration(back), id)).toBe(false);
    stableThroughReloads(back);
  });

  it('an interrupted Elena incident proves nothing about where she went', () => {
    const back = caught(omenOf(activeGame(), ELENA));
    expect(holdsCampaignFact(back, 'elena_absent', preview)).toBe(false);
  });
});

describe('the Vance investigation defers (N6) and resumes as the same occurrence', () => {
  it('keeps its source iteration and omen time, reorients instead of repeating the omen, and pays once', () => {
    const vance = event(VANCE);
    const omen = ticks(omenOf(activeGame(), VANCE), 5);
    const left = remaining(omen);
    const back = caught(omen);
    expect(recordOf(back, VANCE)).toEqual({ status: 'deferred', sourceIteration: 1, origin: 'play', remainingOmenSec: left });
    expect(ticks(back, 30).pendingDilemma).toBeNull();
    const resumed = ticks(near(back, VANCE), STEP);
    expect(resumed.pendingDilemma?.id).toBe(VANCE);
    expect(remaining(resumed)).toBeCloseTo(left, 9);
    expect(texts(resumed)).toContain(vance.campaign?.reorientation);
    expect(texts(resumed)).not.toContain(vance.omen);
    const presented = untilPresented(resumed);
    const before = presented.cycles;
    const chosen = must(commit(presented, 'report_vance', VANCE));
    expect(recordOf(chosen, VANCE)).toMatchObject({ status: 'resolved', outcome: 'report_vance', sourceIteration: 1 });
    expect(chosen.cycles - before).toBe(defined(vance.choices.find((c) => c.id === 'report_vance')).effects.cyclesDelta);
    expect(holdsCampaignFact(chosen, 'vance_dismissed', preview)).toBe(true);
    expect(comesBack(nextIteration(chosen), VANCE)).toBe(false);
  });

  it('a true note seen in its window but interrupted resumes after the window closes', () => {
    const omen = omenOf(toIteration(activeGame(), 4), TRUE_NOTE);
    const back = caught(omen);
    expect(back.iteration).toBe(5);
    expect(recordOf(back, TRUE_NOTE)).toMatchObject({ status: 'deferred', sourceIteration: 4 });
    const resumed = untilPresented(near(back, TRUE_NOTE));
    expect(resumed.activeDilemmaId).toBe(TRUE_NOTE);
    expect(texts(resumed)).toContain(event(TRUE_NOTE).campaign?.reorientation);
  });
});

describe('legacy history without a stored choice (H09, NH-03.6)', () => {
  it('maps a known completion to legacy_unknown, never from traits, and never replays it', () => {
    const played = { ...rich(createInitialState(preview)), resolvedDilemmas: [ELENA, NIGHT], traits: ['EMPATHETIC', 'EMPATHETIC'] as GameState['traits'] };
    const active = must(activateCampaignRules(played, preview));
    for (const id of [ELENA, NIGHT]) expect(recordOf(active, id)).toEqual({ status: 'resolved', outcome: 'legacy_unknown', sourceIteration: 1, origin: 'legacy' });
    expect(holdsCampaignFact(active, 'elena_absent', preview)).toBe(true);
    let state = active;
    for (let wipeCount = 0; wipeCount < 2; wipeCount++) {
      state = nextIteration(state);
      expect(comesBack(state, ELENA)).toBe(false);
      expect(comesBack(state, NIGHT)).toBe(false);
    }
    expect(endingEvidence(state, preview)).toEqual(['EMPATHETIC', 'EMPATHETIC']);
  });

  it('refuses a new-format record whose outcome belongs to another event, or a played legacy_unknown', () => {
    const chosen = resolveEvent(activeGame(), NIGHT, 'finish_the_batch');
    const forge = (record: unknown) => serialize({ ...chosen, campaign: { ...chosen.campaign, events: { ...chosen.campaign.events, [NIGHT]: record as CampaignRecord } } });
    expect(() => deserialize(forge({ status: 'resolved', outcome: 'report_vance', sourceIteration: 1, origin: 'play' }), preview)).toThrow(/unknown outcome/);
    expect(() => deserialize(forge({ status: 'resolved', outcome: 'legacy_unknown', sourceIteration: 1, origin: 'play' }), preview)).toThrow(/unknown outcome/);
    expect(() => deserialize(forge({ status: 'resolved', outcome: 'interrupted', sourceIteration: 1, origin: 'play' }), preview)).toThrow(/unknown outcome/);
  });
});
