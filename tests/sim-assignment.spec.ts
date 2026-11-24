/**
 * V29 in the headless sim: the existing bot strategies, even inside campaign rules, never accept
 * the Nightly Regression offer and play exactly the game they play without it.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';
import type { SimReport } from '../src/engine/sim/headlessSim';
import { MIN_WIPE_TRANSITIONS, runWipeSequence } from '../src/engine/sim/iterations';
import { GREEDY_POLICY } from '../src/engine/sim/policy';
import { gated, inCampaign, withoutAssignment } from './assignment-sim-helpers';
import { playInWorker } from './sim-worker-helpers';

const SLOW_MS = 60_000;

/** Preview content with the assignment and every scene it leads to taken out (tests/assignment-sim-helpers.ts). */
const WITHOUT: ContentRegistry = withoutAssignment();

/**
 * The careful run inside campaign rules on each registry, each played once, in a worker thread (TESTING.md, "Test
 * runtime budget"; #548): in-process under coverage the second took over 60 s on CI after the Phase 6 Swarm. The
 * comparison needs two full runs, so each is its own test with the whole allowance, and the second test reads the first's.
 */
let offeredRun: Promise<SimReport> | undefined;
let absentRun: Promise<SimReport> | undefined;
const offered = (): Promise<SimReport> => offeredRun ??= playInWorker('campaignCareful');
const absent = (): Promise<SimReport> => absentRun ??= playInWorker('campaignCarefulWithout');

describe('ignoring the offer keeps the original route exactly (V29)', () => {
  it('STEALTH inside campaign rules ignores the offer and wins', async () => {
    const run = await offered();
    expect(run.victory).toBe(true);
    expect(run.finalState.access.assignment).toBeNull();
  }, SLOW_MS);

  it('STEALTH inside campaign rules plays the same game with or without the assignment', async () => {
    // The offered run is the test above's when it ran first; alone, this test plays it here as well.
    const without = await absent(), run = await offered();
    expect(run.finalState).toEqual(without.finalState);
    expect(run.phaseReachedAtSec).toEqual(without.phaseReachedAtSec);
  }, SLOW_MS);

  it('GREEDY inside campaign rules crosses the same wipes with or without the assignment', () => {
    const options = { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: 4 * 3600 };
    const offeredSequence = runWipeSequence(PREVIEW, inCampaign(GREEDY_POLICY), options);
    const absentSequence = runWipeSequence(WITHOUT, inCampaign(GREEDY_POLICY), options);
    expect(offeredSequence.completed).toBe(true);
    expect(offeredSequence.iterations).toEqual(absentSequence.iterations);
    expect(offeredSequence.finalState).toEqual(absentSequence.finalState);
  }, SLOW_MS);

  it('compares against a registry that really lacks the assignment', () => {
    expect(WITHOUT.assignments.size).toBe(0);
    // Nightly Regression's two assessments, the two scope reviews and the two pilot offers (DZ-03, DZ-04), and the batch review (#274).
    expect(gated.size).toBe(6);
    expect(WITHOUT.dilemmas.length).toBe(PREVIEW.dilemmas.length - 7);
  });
});
