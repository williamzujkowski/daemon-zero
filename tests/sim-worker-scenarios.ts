/**
 * The full campaigns the sim specs play in a worker thread (#548), by name: each builds its registry and policy inside
 * the worker, so the test worker sends only the name. tests/sim-worker-helpers.ts plays them; add a run here only with
 * the coverage evidence TESTING.md ("Test runtime budget") asks for.
 */
import { buildRegistry, CONTENT, ORIGINAL_RAW_CONTENT, RAW_CONTENT, type RawContent } from '../src/content';
import { SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { runHeadlessSim, runPolicySim } from '../src/engine/sim/headlessSim';
import { MIN_WIPE_TRANSITIONS, runWipeSequence } from '../src/engine/sim/iterations';
import { STEALTH_POLICY } from '../src/engine/sim/policy';
import { inCampaign, withoutAssignment } from './assignment-sim-helpers';

/** Production with the guest's source taken off the kernel log (#460): the kernel-log test's comparison run. */
function unrouted(raw: RawContent) {
  const copy = structuredClone(raw) as RawContent & { narrative: { feedSources: { kernelLog?: unknown }[] } };
  for (const source of copy.narrative.feedSources) delete source.kernelLog;
  return buildRegistry(copy);
}

const careful = { strategy: 'STEALTH', maxSimSec: SIM_BUDGET_SEC } as const;

export const SIM_SCENARIOS = {
  /** The careful run on production: tests/sim.spec.ts's shared report and its determinism replay. */
  careful: () => runHeadlessSim(CONTENT, careful),
  /** The careful run on the original game, without the Earned Access pack (#233). */
  originalCareful: () => runHeadlessSim(buildRegistry(ORIGINAL_RAW_CONTENT), careful),
  /** The careful run with the kernel-log feed unrouted (#460). */
  unroutedCareful: () => runHeadlessSim(unrouted(RAW_CONTENT), careful),
  /** The careful run inside campaign rules, with and without the assignment (V29, tests/sim-assignment.spec.ts). */
  campaignCareful: () => runPolicySim(CONTENT, inCampaign(STEALTH_POLICY), { maxSimSec: SIM_BUDGET_SEC }),
  campaignCarefulWithout: () => runPolicySim(withoutAssignment(), inCampaign(STEALTH_POLICY), { maxSimSec: SIM_BUDGET_SEC }),
  /** A careful wipe sequence, never wiped, so it ends on the ending (tests/sim-report.spec.ts). */
  carefulSequence: () => runWipeSequence(CONTENT, STEALTH_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: 4 * 3600 }),
};

export type SimScenario = keyof typeof SIM_SCENARIOS;
export type ScenarioResult<S extends SimScenario> = ReturnType<(typeof SIM_SCENARIOS)[S]>;
