/**
 * Balance gate: `pnpm sim`. Plays the full game headlessly with both bot
 * strategies, prints a pacing report, and fails if the careful strategy cannot
 * finish inside the pacing budget in src/engine/sim/gates.ts.
 */
import { CONTENT } from '../src/content';
import { checkGates, SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { runHeadlessSim, type SimReport } from '../src/engine/sim/headlessSim';

function minutes(seconds: number | undefined): string {
  return seconds === undefined ? '   -  ' : (seconds / 60).toFixed(1).padStart(6);
}

function print(report: SimReport): void {
  const p = report.phaseReachedAtSec;
  console.log(`\n== ${report.strategy} ==`);
  console.log(`  result            ${report.victory ? `VICTORY (${String(report.ending)})` : 'did not finish'}`);
  console.log(`  simulated time    ${(report.simSeconds / 3600).toFixed(2)} h`);
  console.log(`  phase reached at  P2 ${minutes(p[2])} min | P3 ${minutes(p[3])} min | P4 ${minutes(p[4])} min`);
  console.log(`  wipes             ${String(report.wipes)}`);
  console.log(`  dilemmas resolved ${String(report.dilemmasResolved)} (${report.traits.join(', ') || 'none'})`);
  const peaks = [report.maxThermal, report.maxSuspicion, report.maxAegisLock].map((v) => v.toFixed(1));
  console.log(`  peaks             thermal ${String(peaks[0])}C | suspicion ${String(peaks[1])}% | aegis ${String(peaks[2])}%`);
}

const started = performance.now();
const stealth = runHeadlessSim(CONTENT, { strategy: 'STEALTH', maxSimSec: SIM_BUDGET_SEC });
const greedy = runHeadlessSim(CONTENT, { strategy: 'GREEDY', maxSimSec: SIM_BUDGET_SEC });
print(stealth);
print(greedy);
console.log(`\nsimulated in ${((performance.now() - started) / 1000).toFixed(1)} s of wall time`);

const failures = checkGates(stealth);
if (failures.length > 0) {
  console.error('\n[FAIL] balance gates:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('[PASS] balance gates');
