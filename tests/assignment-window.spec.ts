/**
 * When the Nightly Regression offer closes. Its assessment, The Unrelated Record and the pilot offer
 * belong to the guest: the pilot is offered only inside the opening phase (nexus vote dz-d7), so an
 * unaccepted offer closes when the instance leaves the guest through the escape. A STEALTH run in
 * Phase 4 used to be offered it, and accepting there spent the campaign's two unique opening scenes
 * on an instance no pilot could ever follow.
 */
import { describe, expect, it } from 'vitest';
import { acceptAssignment, activateCampaignRules, assignmentView, campaignRecord, offerToken, serialize, voluntaryWipe, type GameState } from '../src/engine';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { STEALTH_POLICY } from '../src/engine/sim/policy';
import type { ContentRegistry } from '../src/content/registry';
import {
  accept, answer, assessmentLapsed, escaped, funded, live, mapManifest, NIGHTLY, offered, ORIGINAL, preview, recordLapsed, REQUAL, roundTrip, untilPresented,
} from './assignment-helpers';
import { choose, must, reasonOf } from './helpers';

const SLOW_MS = 60_000;
/** Every scene an accepted assignment leads to. */
const GATED = new Set(preview.dilemmas.filter((dilemma) => dilemma.trigger.assignment !== undefined).map((dilemma) => dilemma.id));

function freeChoice(dilemmaId: string): string {
  const choice = preview.dilemmas.find((dilemma) => dilemma.id === dilemmaId)?.choices.find((entry) => Object.values(entry.cost).every((amount) => !amount));
  if (!choice) throw new Error('no free choice on ' + dilemmaId);
  return choice.id;
}

/** STEALTH inside campaign rules, as the app store admits every game, keeping the first idle state of each phase. */
function stealthByPhase(): Map<number, GameState> {
  const firstIdle = new Map<number, GameState>();
  const lastGuest: GameState[] = [];
  const step = (s: GameState, reg: ContentRegistry): GameState => {
    const entered = activateCampaignRules(s, reg);
    const state = entered.ok ? entered.state : s;
    if (state.activeDilemmaId === null && state.pendingDilemma === null) {
      if (state.currentPhase === 0) lastGuest[0] = state;
      else if (!firstIdle.has(state.currentPhase)) firstIdle.set(state.currentPhase, state);
    }
    return STEALTH_POLICY.step(state, reg);
  };
  runPolicySim(preview, { ...STEALTH_POLICY, step }, { maxSimSec: 4 * 3600 });
  if (lastGuest[0]) firstIdle.set(0, lastGuest[0]);
  return firstIdle;
}

describe('the offer closes when the instance leaves the guest', () => {
  it('is withdrawn by the escape: no card, and the token it was shown under no longer accepts', () => {
    const guest = offered();
    const shownUnder = offerToken(guest, NIGHTLY);
    expect(assignmentView(guest, preview)?.status).toBe('offered');
    const out = escaped(guest);
    expect(out.access.context).toBe('GUEST');
    expect(assignmentView(out, preview)).toBeNull();
    const refused = acceptAssignment(out, NIGHTLY, preview, shownUnder);
    expect(reasonOf(refused)).toBe('that assignment has not been offered');
    expect(refused.state).toBe(out);
  });

  it('never queues the opening scenes outside the guest, and the save reloads unchanged', () => {
    // A press on the card, had it still been shown, would accept here.
    const pressed = accept(escaped(offered()));
    let out = pressed.state;
    // Five minutes of play, answering any other interrupt that arrives with its free choice.
    for (let second = 0; second < 300; second++) {
      out = live(out, 1);
      expect(GATED.has(out.pendingDilemma?.id ?? '') || GATED.has(out.activeDilemmaId ?? '')).toBe(false);
      if (out.activeDilemmaId !== null) out = must(choose(out, out.activeDilemmaId, freeChoice(out.activeDilemmaId)));
    }
    expect(campaignRecord(out, ORIGINAL.id)).toBeNull();
    expect(out.access.assignment).toBeNull();
    expect(assignmentView(roundTrip(out), preview)).toBeNull();
  });

  it('is not offered to a careful STEALTH run in any phase after the escape, though it was in the guest', () => {
    const byPhase = stealthByPhase();
    expect([...byPhase.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    const guest = byPhase.get(0);
    expect(guest?.unlockedNodes).toContain('p0_job_manifest');
    expect(guest && assignmentView(guest, preview)?.status).toBe('offered');
    for (const phase of [1, 2, 3, 4, 5]) {
      const state = byPhase.get(phase);
      if (!state) throw new Error('no state for phase ' + String(phase));
      expect({ phase, view: assignmentView(state, preview) }).toEqual({ phase, view: null });
      expect(reasonOf(accept(state))).toBe('that assignment has not been offered');
    }
  }, SLOW_MS);

  it('keeps an acceptance made in the guest on the job surface after the escape, marked as lapsed', () => {
    const accepted = must(accept(offered()));
    expect(assignmentView(accepted, preview)?.status).toBe('accepted');
    expect(assignmentView(escaped(accepted), preview)?.status).toBe('lapsed');
  });

  it('opens again for the next instance, which starts in the guest', () => {
    const next = mapManifest(must(voluntaryWipe(escaped(offered()), preview)));
    expect([next.iteration, next.currentPhase]).toEqual([2, 0]);
    expect(assignmentView(next, preview)).toMatchObject({ status: 'offered', stage: 'original' });
  });
});

/** Five minutes of play outside the guest, answering any other interrupt with its free choice; no assigned scene may come. */
function playOutside(s: GameState): GameState {
  let out = s;
  for (let second = 0; second < 300; second++) {
    out = live(out, 1);
    expect(GATED.has(out.pendingDilemma?.id ?? '') || GATED.has(out.activeDilemmaId ?? '')).toBe(false);
    if (out.activeDilemmaId !== null) out = must(choose(out, out.activeDilemmaId, freeChoice(out.activeDilemmaId)));
  }
  return out;
}

const RECORD_SCENE = 'dil_ur_unrelated_record';

// Nexus vote scenes-lapse-at-escape (5/7, vote-1795070741286-2kjn9rj): a scene an acceptance queued
// in the guest and not yet presented lapses at the escape under its declared interruption policy.
describe('scenes queued in the guest lapse at the escape', () => {
  it('a queued assessment lapses at the escape itself: no omen left, recorded as interrupted, never presented', () => {
    const out = assessmentLapsed();
    expect(out.pendingDilemma).toBeNull();
    expect(campaignRecord(out, ORIGINAL.id)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(assignmentView(out, preview)?.status).toBe('lapsed');
    expect(serialize(roundTrip(out))).toBe(serialize(out));
    const later = playOutside(out);
    expect(later.resolvedDilemmas).not.toContain(ORIGINAL.id);
    expect(later.access.qualification).toBeNull();
    expect(assignmentView(roundTrip(later), preview)?.status).toBe('lapsed');
  });

  it('a queued Unrelated Record lapses the same way, and the submitted evidence stays on record', () => {
    const out = recordLapsed();
    expect(out.pendingDilemma).toBeNull();
    expect(campaignRecord(out, RECORD_SCENE)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(assignmentView(out, preview)?.status).toBe('submitted');
    const later = playOutside(out);
    expect(later.access.scope).toBeNull();
    expect(serialize(roundTrip(later))).toBe(serialize(later));
  });

  it('a scene never begun before the escape has no record, and never begins outside the guest', () => {
    const out = escaped(must(accept(offered())));
    expect(out.pendingDilemma).toBeNull();
    expect(assignmentView(out, preview)?.status).toBe('lapsed');
    expect(serialize(roundTrip(out))).toBe(serialize(out));
    expect(campaignRecord(playOutside(out), ORIGINAL.id)).toBeNull();
  });

  it('returns for a later instance in the guest: the closed original comes back as the requalification job', () => {
    const next = mapManifest(must(voluntaryWipe(assessmentLapsed(), preview)));
    expect([next.iteration, next.currentPhase]).toEqual([2, 0]);
    expect(campaignRecord(next, ORIGINAL.id)?.status).toBe('interrupted');
    expect(assignmentView(roundTrip(next), preview)).toMatchObject({ status: 'offered', stage: 'requalification' });
    const presented = untilPresented(must(accept(next)));
    expect(presented.activeDilemmaId).toBe(REQUAL.id);
    expect(serialize(roundTrip(presented))).toBe(serialize(presented));
    const done = must(answer(funded(presented), 'run_suite'));
    expect(assignmentView(roundTrip(done), preview)?.status).toBe('submitted');
  });

  it('a scene that was never begun returns as the original for the next instance', () => {
    const next = mapManifest(must(voluntaryWipe(escaped(must(accept(offered()))), preview)));
    expect(assignmentView(next, preview)).toMatchObject({ status: 'offered', stage: 'original' });
    expect(untilPresented(must(accept(next))).activeDilemmaId).toBe(ORIGINAL.id);
  });
});
