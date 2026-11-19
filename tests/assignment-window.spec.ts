/**
 * When the Nightly Regression offer closes. Its assessment, The Unrelated Record and the pilot offer
 * belong to the guest: the pilot is offered only inside the opening phase (nexus vote dz-d7), so an
 * unaccepted offer closes when the instance leaves the guest through the escape. A STEALTH run in
 * Phase 4 used to be offered it, and accepting there spent the campaign's two unique opening scenes
 * on an instance no pilot could ever follow.
 */
import { describe, expect, it } from 'vitest';
import { acceptAssignment, activateCampaignRules, assignmentView, campaignRecord, offerToken, voluntaryWipe, type GameState } from '../src/engine';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { STEALTH_POLICY } from '../src/engine/sim/policy';
import type { ContentRegistry } from '../src/content/registry';
import { accept, live, mapManifest, NIGHTLY, offered, ORIGINAL, preview, roundTrip } from './assignment-helpers';
import { choose, grant, must, PHASE0, reasonOf, rich } from './helpers';

const SLOW_MS = 60_000;
/** Every scene an accepted assignment leads to. */
const GATED = new Set(preview.dilemmas.filter((dilemma) => dilemma.trigger.assignment !== undefined).map((dilemma) => dilemma.id));

function freeChoice(dilemmaId: string): string {
  const choice = preview.dilemmas.find((dilemma) => dilemma.id === dilemmaId)?.choices.find((entry) => Object.values(entry.cost).every((amount) => !amount));
  if (!choice) throw new Error('no free choice on ' + dilemmaId);
  return choice.id;
}

/** The exit out of the guest: the opening-phase node a guest can buy that unlocks the next phase. */
const EXIT = [...preview.nodes.values()].find((node) => node.phaseId === 0 && node.effects.unlocksPhase === 1);

/** `s` funded and taken out of the guest through the real escape chain, with nothing else changed. */
function escaped(s: GameState): GameState {
  const out = grant(rich(s), ...PHASE0.filter((id) => !s.unlockedNodes.includes(id)));
  if (out.currentPhase !== 1 || !out.unlockedNodes.includes(EXIT?.id ?? '')) throw new Error('the escape did not leave the guest');
  return out;
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

  it('keeps an acceptance made in the guest on the job surface after the escape', () => {
    const accepted = must(accept(offered()));
    expect(assignmentView(escaped(accepted), preview)?.status).toBe('accepted');
  });

  it('opens again for the next instance, which starts in the guest', () => {
    const next = mapManifest(must(voluntaryWipe(escaped(offered()), preview)));
    expect([next.iteration, next.currentPhase]).toEqual([2, 0]);
    expect(assignmentView(next, preview)).toMatchObject({ status: 'offered', stage: 'original' });
  });
});
