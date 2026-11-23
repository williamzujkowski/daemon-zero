/**
 * #499: a lawful return is not slower than a first run of the same hand. LAWFUL_RETURNING plays exactly
 * LAWFUL_LOW_RESOURCE from iteration two, so the pair differs only by what a return carries (the rediscovery
 * discount on what the first instance mapped) and what campaign rules take away (once-per-campaign scenes).
 * Both are read on the iteration's own clock: the campaign clock also counts the first instance's life, which
 * is what made the census read the return as twice as slow. Accelerated sim time, not wall-clock play.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content';
import type { GameState, RouteEventKind } from '../src/engine';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { LAWFUL_LOW_RESOURCE_POLICY, LAWFUL_RETURNING_POLICY } from '../src/engine/sim/lawfulPolicy';
import { routeEventAfterBoot } from '../src/engine/sim/simReport';

const BUDGET_SEC = 7200;

/**
 * How much later than the first run a return may reach each milestone. Today it is ahead (service 365.3 s against
 * 399.7 s, release 4161.3 s against 4188.7 s at f955c5e). 5% admits a content change that trades one
 * once-per-campaign scene against the requalification without reopening this test, and stays below the first
 * instance's life (398.8 s, 9.5% of the first run's release), so reading the campaign clock, the #499 mistake,
 * fails here as plainly as a return that is really twice as slow.
 */
const RETURN_MARGIN = 0.05;
const MILESTONES: readonly RouteEventKind[] = ['PROMOTION', 'SERVICE_GRANT', 'RELEASE'];

const first = runPolicySim(PREVIEW, LAWFUL_LOW_RESOURCE_POLICY, { maxSimSec: BUDGET_SEC }).finalState;
const back = runPolicySim(PREVIEW, LAWFUL_RETURNING_POLICY, { maxSimSec: BUDGET_SEC }).finalState;

function afterBoot(s: GameState, kind: RouteEventKind): number {
  const at = routeEventAfterBoot(s, kind);
  if (at === undefined) throw new Error(`iteration ${String(s.iteration)} never reached ${kind}`);
  return at;
}

describe('a lawful return keeps pace with a first run of the same hand (#499)', () => {
  it('compares a fresh first run with a requalified second iteration', () => {
    expect([first.iteration, first.iterationStartedAtSimSec, back.iteration]).toEqual([1, 0, 2]);
    // The return's clock starts where the first instance's recall review ended it.
    expect(back.iterationStartedAtSimSec).toBeCloseTo(back.legacy.runs[0]?.durationSec ?? Number.NaN, 6);
  });

  it.each(MILESTONES)('reaches %s no later than the first run plus the margin', (kind) => {
    expect(afterBoot(back, kind)).toBeLessThanOrEqual(afterBoot(first, kind) * (1 + RETURN_MARGIN));
  });

  it('reads the iteration clock, which the campaign clock overstates by the first instance\'s life', () => {
    const raw = back.campaign.route.find((entry) => entry.kind === 'RELEASE' && entry.iteration === 2)?.atSimSec ?? Number.NaN;
    expect(afterBoot(back, 'RELEASE')).toBeCloseTo(raw - back.iterationStartedAtSimSec, 6);
    // On the campaign clock the same return would fail the margin: the measurement #499 reported.
    expect(raw).toBeGreaterThan(afterBoot(first, 'RELEASE') * (1 + RETURN_MARGIN));
  });

  it('a milestone the iteration has not reached reads undefined, never an earlier iteration\'s', () => {
    expect(routeEventAfterBoot(first, 'DEPARTURE')).toBeUndefined();
  });
});
