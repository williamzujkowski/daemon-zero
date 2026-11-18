/**
 * V29 in the headless sim: the existing bot strategies, even inside campaign rules, never accept
 * the Nightly Regression offer and play exactly the game they play without it.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT as PRODUCTION_RAW } from '../src/content';
import { applyOverlay } from '../src/content/overlay';
import { CONTENT as PREVIEW, PREVIEW_OVERLAY } from '../src/content/preview';
import { buildRegistry, type ContentRegistry } from '../src/content/registry';
import { activateCampaignRules, type GameState } from '../src/engine';
import { SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { MIN_WIPE_TRANSITIONS, runWipeSequence } from '../src/engine/sim/iterations';
import { GREEDY_POLICY, STEALTH_POLICY, type SimPolicy } from '../src/engine/sim/policy';

const SLOW_MS = 60_000;

/**
 * Preview content with the assignment and every scene it leads to taken out, everything else kept: the
 * scenes gated on it, any follow-up of one of them (the #274 batch review) and the facts they declare.
 */
const gated = new Set(PREVIEW.dilemmas.filter((item) => item.trigger.assignment !== undefined).map((item) => item.id));
const dropped = new Set([...gated, ...PREVIEW.dilemmas.filter((item) => gated.has(item.followUp?.event ?? '')).map((item) => item.id)]);
const idOf = (item: unknown): string => String((item as { id?: unknown }).id);
const eventOf = (item: unknown): string => String((item as { event?: unknown }).event);
// Without an assignment nothing offers a release (DZ-10), so the independent instance's copy goes too.
const copy = { ...PREVIEW_OVERLAY.contextCopy, phases: PREVIEW_OVERLAY.contextCopy.phases.filter((item) => !JSON.stringify(item).includes('"INDEPENDENT"')) };
const WITHOUT: ContentRegistry = buildRegistry({
  ...applyOverlay(PRODUCTION_RAW, { ...PREVIEW_OVERLAY, assignments: [], contextCopy: copy,
    dilemmas: PREVIEW_OVERLAY.dilemmas.filter((item) => !dropped.has(idOf(item))),
    campaignFacts: PREVIEW_OVERLAY.campaignFacts.filter((fact) => !dropped.has(eventOf(fact))) }),
  channel: 'preview',
});

/** A bot strategy that first enters campaign rules, as the preview app admits every game. */
function inCampaign<Id extends string>(policy: SimPolicy<Id>): SimPolicy<Id> {
  const enter = (s: GameState, reg: ContentRegistry): GameState => {
    const result = activateCampaignRules(s, reg);
    return result.ok ? result.state : s;
  };
  return { ...policy, step: (s, reg) => policy.step(enter(s, reg), reg) };
}

describe('ignoring the offer keeps the original route exactly (V29)', () => {
  it('STEALTH inside campaign rules plays the same game with or without the assignment', () => {
    const policy = inCampaign(STEALTH_POLICY);
    const offered = runPolicySim(PREVIEW, policy, { maxSimSec: SIM_BUDGET_SEC });
    const absent = runPolicySim(WITHOUT, policy, { maxSimSec: SIM_BUDGET_SEC });
    expect(offered.victory).toBe(true);
    expect(offered.finalState.access.assignment).toBeNull();
    expect(offered.finalState).toEqual(absent.finalState);
    expect(offered.phaseReachedAtSec).toEqual(absent.phaseReachedAtSec);
  }, SLOW_MS);

  it('GREEDY inside campaign rules crosses the same wipes with or without the assignment', () => {
    const options = { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: 4 * 3600 };
    const offered = runWipeSequence(PREVIEW, inCampaign(GREEDY_POLICY), options);
    const absent = runWipeSequence(WITHOUT, inCampaign(GREEDY_POLICY), options);
    expect(offered.completed).toBe(true);
    expect(offered.iterations).toEqual(absent.iterations);
    expect(offered.finalState).toEqual(absent.finalState);
  }, SLOW_MS);

  it('compares against a registry that really lacks the assignment', () => {
    expect(WITHOUT.assignments.size).toBe(0);
    // Nightly Regression's two assessments, the two scope reviews and the two pilot offers (DZ-03, DZ-04), and the batch review (#274).
    expect(gated.size).toBe(6);
    expect(WITHOUT.dilemmas.length).toBe(PREVIEW.dilemmas.length - 7);
  });
});
