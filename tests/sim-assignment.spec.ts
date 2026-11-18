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

/** Preview content with the assignment and every scene it leads to taken out, everything else kept. */
const WITHOUT: ContentRegistry = buildRegistry({
  ...applyOverlay(PRODUCTION_RAW, { ...PREVIEW_OVERLAY, assignments: [],
    dilemmas: PREVIEW_OVERLAY.dilemmas.filter((item) => !JSON.stringify(item).includes('"assignment"')) }),
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
    // Nightly Regression's two assessments, the two scope reviews and the two pilot offers (DZ-03, DZ-04).
    expect(WITHOUT.dilemmas.length).toBe(PREVIEW.dilemmas.length - 6);
  });
});
