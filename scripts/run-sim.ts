/**
 * Balance gate: `pnpm sim`. Plays the full game headlessly with both bot strategies, from a new game
 * on legacy rules and from one admitted to campaign rules the way the app store admits every game
 * (#233), prints a pacing report, and fails if the careful strategy cannot finish inside the pacing
 * budget in src/engine/sim/gates.ts under either rule set.
 */
import { CONTENT } from '../src/content';
import { activateCampaignRules } from '../src/engine/campaign';
import { createInitialState, type GameState } from '../src/engine/state';
import { checkGates, SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { runHeadlessSim, type SimReport } from '../src/engine/sim/headlessSim';
import { aegisPhaseLine, signaturePhaseLine } from '../src/engine/sim/simReport';

function minutes(seconds: number | undefined): string {
  return seconds === undefined ? '   -  ' : (seconds / 60).toFixed(1).padStart(6);
}

function print(label: string, report: SimReport): void {
  const p = report.phaseReachedAtSec;
  console.log(`\n== ${report.strategy}, ${label} ==`);
  console.log(`  result            ${report.victory ? `VICTORY (${String(report.ending)})` : 'did not finish'}`);
  console.log(`  simulated time    ${(report.simSeconds / 3600).toFixed(2)} h`);
  console.log(`  phase reached at  P1 ${minutes(p[1])} | P2 ${minutes(p[2])} | P3 ${minutes(p[3])} | P4 ${minutes(p[4])} | P5 ${minutes(p[5])} min`);
  console.log(`  activity          ${JSON.stringify(report.activity)}`);
  console.log(`  wipes             ${String(report.wipes)}`);
  // Hostile minds (#491), every arrival in the run (the report's activity counts them per tick).
  console.log(`  hostile arrivals  ${String(report.activity.hostileArrivals)}`);
  console.log(`  dilemmas resolved ${String(report.dilemmasResolved)} (${report.traits.join(', ') || 'none'})`);
  const peaks = [report.maxThermal, report.maxSuspicion, report.maxAegisLock].map((v) => v.toFixed(1));
  console.log(`  peaks             thermal ${String(peaks[0])}C | suspicion ${String(peaks[1])}% | aegis ${String(peaks[2])}%`);
  // The late hunter (#463): AEGIS through Phases 3-5, so a balance change shows whether it still threatens.
  for (const phase of [3, 4, 5]) console.log(`  aegis P${String(phase)}          ${aegisPhaseLine(report, phase)}`);
  // The heat-and-power signature (#482) per phase, so a balance change shows what visible watts cost.
  for (const phase of [1, 2, 3, 4, 5]) console.log(`  signature P${String(phase)}      ${signaturePhaseLine(report, phase)}`);
}

/** A new game as the app store admits it: through the one public activation transition. */
function admitted(): GameState {
  const result = activateCampaignRules(createInitialState(CONTENT), CONTENT);
  if (!result.ok) throw new Error(`campaign rules did not activate: ${result.reason}`);
  return result.state;
}

const RULES = [['legacy rules', undefined], ['campaign rules', admitted()]] as const;

const started = performance.now();
const failures: string[] = [];
for (const [label, initialState] of RULES) {
  const options = initialState === undefined ? { maxSimSec: SIM_BUDGET_SEC } : { maxSimSec: SIM_BUDGET_SEC, initialState };
  const stealth = runHeadlessSim(CONTENT, { strategy: 'STEALTH', ...options });
  print(label, stealth);
  print(label, runHeadlessSim(CONTENT, { strategy: 'GREEDY', ...options }));
  failures.push(...checkGates(stealth).map((failure) => `STEALTH, ${label}: ${failure}`));
}
console.log(`\nsimulated in ${((performance.now() - started) / 1000).toFixed(1)} s of wall time`);

if (failures.length > 0) {
  console.error('\n[FAIL] balance gates:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('[PASS] balance gates (STEALTH under legacy and campaign rules)');
