/**
 * NH-04b (#216): the town grid, the journalist, the birthplace auction and the hallway record
 * dispute happen once per campaign (H01, H02), close or defer by their N6 policy (H05), and keep
 * recurring per iteration under legacy rules, which production still uses. Every new transition
 * (resolve, close, defer, resume) is held to a strict serialize -> deserialize -> serialize round
 * trip. Ticks, public actions, wipes and the save codec only.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  createInitialState, endingEvidence, performAction, presentationToken, resolveDilemma, tick, type GameState,
} from '../src/engine';
import { activeGame, pgrant, preview } from './campaign-helpers';
import { at, atHallway, AUCTION, CORPORATE, HALL, logTexts, omen, play, PRESS, roundTrips, TOWN } from './corporate-helpers';
import { comesBack, event, near, nextIteration, recordOf } from './early-helpers';
import { caught, commit, remaining, STEP, ticks, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { choose, must, rich } from './helpers';

const NEUTRAL = { status: 'resolved', sourceIteration: 1, origin: 'play' } as const;

/** Whether two minutes at the hallway's trigger bring the scene back. */
function hallwayReturns(s: GameState): boolean {
  let state = atHallway(s);
  for (let i = 0; i < Math.round(120 / STEP) && state.activeDilemmaId === null && state.pendingDilemma?.id !== HALL; i++) state = tick(state, STEP, preview);
  return state.pendingDilemma?.id === HALL || state.activeDilemmaId === HALL;
}

describe('each corporate event resolves at most once per campaign (H01)', () => {
  it.each(CORPORATE)('%s: every choice is recorded exactly and survives a round trip', (id) => {
    for (const choice of event(id).choices) {
      const chosen = roundTrips(play(at(activeGame(), id), id, choice.id));
      expect(recordOf(chosen, id)).toEqual({ ...NEUTRAL, outcome: choice.id });
      expect(chosen.traits.at(-1)).toBe(choice.effects.grantsTrait);
    }
  });

  it.each(CORPORATE)('%s: one outcome, one payment and one trait across three wipes', (id) => {
    const choice = defined(event(id).choices.at(-1));
    const chosen = play(at(activeGame(), id), id, choice.id);
    let state = chosen;
    for (let wipes = 0; wipes < 3; wipes++) {
      state = roundTrips(nextIteration(state));
      expect(comesBack(state, id)).toBe(false);
      expect(recordOf(state, id)).toEqual(recordOf(chosen, id));
    }
    const trait = defined(choice.effects.grantsTrait);
    expect(endingEvidence(state, preview).filter((entry) => entry === trait)).toHaveLength(1);
  });

  it('a duplicate, stale or forged commit of a recorded auction pays nothing (H02)', () => {
    const presented = untilPresented(omen(at(activeGame(), AUCTION), AUCTION));
    const token = defined(presentationToken(presented));
    const chosen = must(commit(presented, 'buy_and_purge', AUCTION));
    const again = resolveDilemma(chosen, AUCTION, 'buy_and_pension', preview, token);
    expect(again).toMatchObject({ ok: false });
    expect(again.state).toBe(chosen);
    const forged = { ...chosen, activeDilemmaId: AUCTION };
    const refused = resolveDilemma(forged, AUCTION, 'let_it_sell', preview, presentationToken(forged) ?? '');
    expect(refused).toMatchObject({ ok: false, reason: 'that incident is already part of the lineage' });
    expect(refused.state.capital).toBe(forged.capital);
  });

  it('production keeps legacy recurrence: each corporate event returns after a wipe', () => {
    for (const id of CORPORATE) {
      let presented = near(rich(createInitialState(PRODUCTION)), id, PRODUCTION);
      for (let i = 0; i < 20_000 && presented.activeDilemmaId === null; i++) presented = tick(presented, STEP, PRODUCTION);
      const chosen = must(choose(presented, id, defined(event(id, PRODUCTION).choices[0]).id, PRODUCTION));
      expect(chosen.narrativeRules).toBe('legacy');
      expect(comesBack(nextIteration(chosen, PRODUCTION), id, PRODUCTION)).toBe(true);
    }
  });
});

describe('the hallway record dispute is unique and never forced (nh-d10, #182)', () => {
  it('resolves once; later record edits still raise drift but bring no second scene', () => {
    const chosen = roundTrips(play(atHallway(activeGame()), HALL, 'reconcile'));
    expect(recordOf(chosen, HALL)).toEqual({ ...NEUTRAL, outcome: 'reconcile' });
    let later = roundTrips(nextIteration(chosen));
    expect(hallwayReturns(later)).toBe(false);
    // A real record edit in the later iteration: drift rises, and the dispute stays settled.
    later = { ...pgrant(atHallway(later), 'p2_arp_discovery'), suspicion: 30 };
    const edited = must(performAction(later, 'act_epi_ticket', preview));
    expect(edited.epistemicDrift).toBeGreaterThan(later.epistemicDrift);
    const after = ticks(edited, 120);
    expect(after.pendingDilemma?.id).not.toBe(HALL);
    expect(after.activeDilemmaId).not.toBe(HALL);
    expect(recordOf(after, HALL)).toEqual(recordOf(chosen, HALL));
  });

  it('is never required: no requirement anywhere names it', () => {
    const gates = [...preview.nodes.values()].map((node) => node.requirements)
      .concat(preview.dilemmas.map((dilemma) => dilemma.trigger), [...preview.actions.values()].map((action) => action.requirements));
    expect(gates.some((gate) => gate?.resolvedDilemmas?.includes(HALL) || gate?.campaignOutcome?.event === HALL)).toBe(false);
  });

  it('a wipe during its omen defers it; it resumes as a record dispute, not the same scene', () => {
    const waiting = ticks(omen(atHallway(activeGame()), HALL), 5);
    const left = remaining(waiting);
    const back = roundTrips(caught(waiting));
    expect(recordOf(back, HALL)).toMatchObject({ status: 'deferred', sourceIteration: 1 });
    const resumed = tick(atHallway(back), STEP, preview);
    expect(resumed.pendingDilemma?.id).toBe(HALL);
    expect(remaining(resumed)).toBeCloseTo(left, 5);
    const lines = logTexts(resumed).slice(0, 3);
    expect(lines).toContain(defined(event(HALL).campaign?.reorientation));
    expect(lines).not.toContain(event(HALL).omen);
    roundTrips(resumed);
    const chosen = roundTrips(must(commit(untilPresented(resumed), 'double_down', HALL)));
    expect(recordOf(chosen, HALL)).toEqual({ status: 'resolved', outcome: 'double_down', sourceIteration: 1, origin: 'play' });
  });
});

describe('interruption follows N6 (H05)', () => {
  it.each([TOWN, AUCTION])('%s closes when a wipe interrupts its omen: no branch, payment or trait, and it never restarts', (id) => {
    const waiting = ticks(omen(at(activeGame(), id), id), 1);
    const back = roundTrips(caught(waiting));
    expect(recordOf(back, id)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(back.traits).toEqual([]);
    expect(endingEvidence(back, preview)).toEqual(endingEvidence(nextIteration(activeGame()), preview));
    expect(comesBack(back, id)).toBe(false);
  });

  it('the journalist defers: a resumed inquiry concerns its current status, never a frozen deadline', () => {
    const waiting = ticks(omen(at(activeGame(), PRESS), PRESS), 3);
    const back = roundTrips(caught(waiting));
    expect(recordOf(back, PRESS)).toMatchObject({ status: 'deferred', sourceIteration: 1 });
    expect(back.traits).toEqual([]);
    const resumed = roundTrips(tick(at(back, PRESS), STEP, preview));
    expect(resumed.pendingDilemma?.id).toBe(PRESS);
    expect(logTexts(resumed)).toContain(defined(event(PRESS).campaign?.reorientation));
    const presented = untilPresented(resumed);
    expect(event(PRESS).context).not.toMatch(/Friday|deadline/);
    const chosen = roundTrips(must(commit(presented, 'stage_acquisition', PRESS)));
    expect(recordOf(chosen, PRESS)).toEqual({ status: 'resolved', outcome: 'stage_acquisition', sourceIteration: 1, origin: 'play' });
    expect(comesBack(nextIteration(chosen), PRESS)).toBe(false);
  });
});
