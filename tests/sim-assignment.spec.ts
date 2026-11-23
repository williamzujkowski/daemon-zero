/**
 * V29 in the headless sim: the existing bot strategies, even inside campaign rules, never accept
 * the Nightly Regression offer and play exactly the game they play without it.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT as ORIGINAL_RAW } from '../src/content';
import { applyPack } from '../src/content/pack';
import { CONTENT as PREVIEW, EARNED_ACCESS_PACK } from '../src/content';
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
// Without an assignment nothing offers a release (DZ-10) or a departure (DZ-11), so the independent instance's copy goes too.
const independent = (item: unknown): boolean => JSON.stringify(item).includes('"INDEPENDENT"');
const copy = { ...EARNED_ACCESS_PACK.contextCopy, phases: EARNED_ACCESS_PACK.contextCopy.phases.filter((item) => !independent(item)),
  threatResponses: EARNED_ACCESS_PACK.contextCopy.threatResponses.filter((item) => !independent(item)) };
const WITHOUT: ContentRegistry = buildRegistry({
  ...applyPack(ORIGINAL_RAW, { ...EARNED_ACCESS_PACK, assignments: [], contextCopy: copy,
    dilemmas: EARNED_ACCESS_PACK.dilemmas.filter((item) => !dropped.has(idOf(item))),
    campaignFacts: EARNED_ACCESS_PACK.campaignFacts.filter((fact) => !dropped.has(eventOf(fact))) }),
});

/** A bot strategy that first enters campaign rules, as the preview app admits every game. */
function inCampaign<Id extends string>(policy: SimPolicy<Id>): SimPolicy<Id> {
  const enter = (s: GameState, reg: ContentRegistry): GameState => {
    const result = activateCampaignRules(s, reg);
    return result.ok ? result.state : s;
  };
  return { ...policy, step: (s, reg) => policy.step(enter(s, reg), reg) };
}

/**
 * The careful run inside campaign rules on each registry, each computed once (TESTING.md, "Test runtime budget"): the
 * comparison needs two full runs, so each is its own test with the whole allowance, and the second test reads the first's.
 */
const stealthRuns = new Map<ContentRegistry, ReturnType<typeof runPolicySim>>();
function stealthRun(registry: ContentRegistry): ReturnType<typeof runPolicySim> {
  let run = stealthRuns.get(registry);
  if (run === undefined) {
    run = runPolicySim(registry, inCampaign(STEALTH_POLICY), { maxSimSec: SIM_BUDGET_SEC });
    stealthRuns.set(registry, run);
  }
  return run;
}

describe('ignoring the offer keeps the original route exactly (V29)', () => {
  it('STEALTH inside campaign rules ignores the offer and wins', () => {
    const offered = stealthRun(PREVIEW);
    expect(offered.victory).toBe(true);
    expect(offered.finalState.access.assignment).toBeNull();
  }, SLOW_MS);

  it('STEALTH inside campaign rules plays the same game with or without the assignment', () => {
    // The offered run is the test above's when it ran first; alone, this test plays it here as well.
    const absent = stealthRun(WITHOUT), offered = stealthRun(PREVIEW);
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
