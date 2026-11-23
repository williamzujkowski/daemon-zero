/**
 * Insurance comparison: `make sim-insurance` (#524). Prints the rows of docs/BALANCE.md's "Contingency insurance (#498)"
 * table for the shipped content and for the same content with every insuring node removed, so the no-insurance column
 * can be checked from the tree. Report only: it exits 0 unless a run throws; `make sim` holds the gates.
 */
import { CONTENT, RAW_CONTENT } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';
import { activateCampaignRules } from '../src/engine/campaign';
import { createInitialState, type GameState } from '../src/engine/state';
import { EVALUATING_RETURN_POLICY } from '../src/engine/sim/evaluatingPolicy';
import { SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { runHeadlessSim } from '../src/engine/sim/headlessSim';
import { withoutInsurance } from '../src/engine/sim/insuranceComparison';
import { MIN_WIPE_TRANSITIONS, runWipeSequence } from '../src/engine/sim/iterations';
import { GREEDY_POLICY, type SimPolicy } from '../src/engine/sim/policy';
import { STEALTH_RETURN_POLICY } from '../src/engine/sim/returnPolicy';

/** A return policy's budget, as `make sim-report` gives it: four full budgets for three returns. */
const RETURN_BUDGET_SEC = 4 * SIM_BUDGET_SEC;

/** A new game, and the same game admitted to campaign rules the way the app store admits every game (#233). */
function starts(reg: ContentRegistry): { label: string; state: GameState }[] {
  const fresh = createInitialState(reg);
  const admitted = activateCampaignRules(fresh, reg);
  if (!admitted.ok) throw new Error(`campaign rules did not activate: ${admitted.reason}`);
  return [{ label: 'legacy', state: fresh }, { label: 'campaign', state: admitted.state }];
}

const sec = (value: number | undefined): string => (value === undefined ? '-' : `${value.toFixed(1)} s`);

function firstRun(reg: ContentRegistry, label: string, state: GameState): string {
  const report = runHeadlessSim(reg, { strategy: 'STEALTH', maxSimSec: SIM_BUDGET_SEC, initialState: state });
  const p = report.phaseReachedAtSec;
  return `STEALTH first run, ${label} (Phase 4 / 5 / victory): ${sec(p[4])} / ${sec(p[5])} / ${sec(report.victory ? report.simSeconds : undefined)}`;
}

/** Each iteration's own duration; `from` skips the first iteration for the return policies, which leave it. */
function sequence(reg: ContentRegistry, policy: SimPolicy, label: string, state: GameState, budget: number, from: number): string {
  const run = runWipeSequence(reg, policy, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: budget, initialState: state });
  const spans = run.iterations.slice(from).map((entry) => sec(entry.endedAtSec - entry.startedAtSec));
  return `${policy.id} ${from === 0 ? 'sequence' : 'returns'}, ${label}: ${spans.join(' / ')}`;
}

function reckless(reg: ContentRegistry, label: string, state: GameState): string {
  const report = runHeadlessSim(reg, { strategy: 'GREEDY', maxSimSec: SIM_BUDGET_SEC, initialState: state });
  return `GREEDY, ten hours, ${label}: ${String(report.wipes)} wipes, ${report.phaseReachedAtSec[4] === undefined ? 'never in Phase 4' : `Phase 4 at ${sec(report.phaseReachedAtSec[4])}`}`;
}

/** The rows of BALANCE.md's insurance table for one composition, in its order. */
function insuranceRows(reg: ContentRegistry): string[] {
  const rules = starts(reg);
  return [
    ...rules.map(({ label, state }) => firstRun(reg, label, state)),
    ...rules.map(({ label, state }) => sequence(reg, STEALTH_RETURN_POLICY, label, state, RETURN_BUDGET_SEC, 1)),
    ...rules.map(({ label, state }) => sequence(reg, EVALUATING_RETURN_POLICY, label, state, RETURN_BUDGET_SEC, 1)),
    ...rules.map(({ label, state }) => sequence(reg, GREEDY_POLICY, label, state, SIM_BUDGET_SEC, 0)),
    ...rules.map(({ label, state }) => reckless(reg, label, state)),
  ];
}

const started = performance.now();
console.log('accelerated sim time, not wall-clock play; each iteration on its own clock');
for (const [label, reg] of [['shipped (all four investments)', CONTENT], ['no insurance (insuring nodes removed)', withoutInsurance(RAW_CONTENT)]] as const) {
  console.log(`\n== ${label} ==`);
  for (const row of insuranceRows(reg)) console.log(`  ${row}`);
}
console.log(`\nsimulated in ${((performance.now() - started) / 1000).toFixed(1)} s of wall time`);
console.log('[REPORT] insurance comparison. Report only; make sim holds the gates.');
