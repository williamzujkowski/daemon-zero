/**
 * DZ-13 qualification (#233, 13.11; VALIDATION H14, H25, V33) on the composition the release enables:
 * every alternative of every mandatory Phase 5 obligation completes it for the rest of the campaign, and a
 * campaign whose authored frontier is exhausted keeps playing, carefully to an ending or recklessly across
 * three wipes, without replaying a completed story. Everything goes through public actions, ticks, wipes and the save codec.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  activateCampaignRules, createInitialState, obligationReceipt, offeredChoices, voluntaryWipe, type GameState,
} from '../src/engine';
import { MIN_WIPE_TRANSITIONS, runWipeSequence } from '../src/engine/sim/iterations';
import { untilObligationsComplete } from '../src/engine/sim/obligationRun';
import { GREEDY_POLICY, STEALTH_POLICY } from '../src/engine/sim/policy';
import { activeGame, preview } from './campaign-helpers';
import { caught, ticks, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { exactReload, next, omen, own, play } from './minds-helpers';
import { must } from './helpers';
import { finalNode, OBLIGATIONS, REVIEWS } from './obligation-helpers';

const FINAL = finalNode();
const dilemma = (id: string) => defined(preview.dilemmas.find((entry) => entry.id === id));
const SIM_SEC = 10 * 3600;
const SLOW_MS = 120_000;

/** Each obligation with every choice it offers when its crisis arrives in a plain campaign. */
const ORIGINALS = OBLIGATIONS.flatMap((id) => {
  const presented = untilPresented(omen(activeGame(), id, []));
  return offeredChoices(presented, dilemma(id), preview).map((choice) => [id, choice.id] as const);
});

describe('every alternative of every mandatory obligation (V33, H14)', () => {
  it('offers at least one free choice on each obligation, so none can soft-lock the final protocol', () => {
    expect(FINAL.requirements?.campaignObligations).toEqual(OBLIGATIONS);
    for (const id of OBLIGATIONS) {
      const presented = untilPresented(omen(activeGame(), id, []));
      const free = offeredChoices(presented, dilemma(id), preview).filter((choice) => Object.values(choice.cost).every((value) => value === 0));
      expect(free.length).toBeGreaterThan(0);
    }
    expect(ORIGINALS.length).toBeGreaterThanOrEqual(OBLIGATIONS.length * 2);
  });

  it.each(ORIGINALS)('%s answered with %s stays complete in later iterations and never returns', (id, choiceId) => {
    const answered = exactReload(play(activeGame(), id, choiceId));
    expect(obligationReceipt(answered, id, preview)).toMatchObject({ via: 'original', outcome: choiceId });
    let later = answered;
    for (let wipes = 0; wipes < 3; wipes++) {
      later = exactReload(next(later));
      expect(obligationReceipt(later, id, preview)).toMatchObject({ via: 'original', outcome: choiceId });
      const waited = ticks(own(later, ...FINAL.prerequisites), 120);
      expect(waited.activeDilemmaId).not.toBe(id);
      expect(waited.pendingDilemma?.id).not.toBe(id);
    }
  });

  it.each(REVIEWS)('%s: every review answer completes its obligation through the review', (reviewId) => {
    const review = dilemma(reviewId);
    const original = defined(review.campaign?.obligation);
    // The original is caught by a wipe during its omen, so its review becomes the way to answer it.
    const lost = exactReload(caught(ticks(omen(activeGame(), original, []), 5)));
    const offered = offeredChoices(untilPresented(omen(lost, reviewId, [])), review, preview);
    expect(offered.map((choice) => choice.id)).toEqual(review.choices.map((choice) => choice.id));
    for (const choice of offered) {
      const done = exactReload(play(lost, reviewId, choice.id));
      expect(obligationReceipt(done, original, preview)).toMatchObject({ via: 'review', receiptEvent: reviewId, outcome: choice.id });
      expect(obligationReceipt(exactReload(next(done)), original, preview)).toMatchObject({ via: 'review', outcome: choice.id });
    }
  });
});

describe('an exhausted authored frontier (H25)', () => {
  let left: GameState;
  let done: Set<string>;
  beforeAll(() => {
    const start = must(activateCampaignRules(createInitialState(preview), preview));
    left = exactReload(must(voluntaryWipe(defined(untilObligationsComplete(start, preview, SIM_SEC)), preview)));
    done = new Set(Object.entries(left.campaign.events).filter(([, record]) => record.status === 'resolved').map(([id]) => id));
  }, SLOW_MS);

  it('a careful return after every obligation was completed reaches an ending on routine work alone', () => {
    expect(done.size).toBeGreaterThan(10);
    const run = runWipeSequence(preview, STEALTH_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SIM_SEC, initialState: left });
    expect(run.iterations.flatMap((entry) => entry.dilemmasMet).filter((id) => done.has(id))).toEqual([]);
    const final = exactReload(run.finalState);
    expect(final.ending).not.toBeNull();
    // Compact recurring operations kept arriving in place of recycled stories.
    expect(final.routine.sequence).toBeGreaterThan(left.routine.sequence + 20);
    for (const id of OBLIGATIONS) expect(obligationReceipt(final, id, preview)?.via).toBe('original');
  }, SLOW_MS);

  it('a reckless return crosses three wipes, meets no completed story and no other story twice', () => {
    const run = runWipeSequence(preview, GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SIM_SEC, initialState: left });
    expect(run.completed).toBe(true);
    expect(run.iterations.length).toBeGreaterThanOrEqual(MIN_WIPE_TRANSITIONS);
    const met = run.iterations.flatMap((entry) => entry.dilemmasMet);
    expect(met.filter((id) => done.has(id))).toEqual([]);
    const once = met.filter((id) => preview.campaign.events.has(id));
    expect(new Set(once).size).toBe(once.length);
    exactReload(run.finalState);
  }, SLOW_MS);
});

describe('the route notes after release, departure and first contact (13.8)', () => {
  const notes = [
    ...[...preview.assignments.values()].flatMap((assignment) => [assignment.pilot?.serviceGrant?.release?.boundary, assignment.pilot?.departure?.boundary]),
    ...preview.swarm.channelEncounters.map((encounter) => encounter.boundary),
  ];

  it('say what comes next and how to stop, and never call the route an unfinished preview', () => {
    expect(notes.filter((note) => note !== undefined)).toHaveLength(3);
    for (const note of notes) {
      const text = [note?.title ?? '', ...(note?.lines ?? [])].join(' ');
      expect(text).toMatch(/^WHAT COMES NEXT: /);
      expect(text).toContain('MENU > SAVES');
      expect(text).toMatch(/an ending/i);
      expect(text).not.toMatch(/preview|not connected|currently ends|no ending has been earned/i);
    }
  });
});
