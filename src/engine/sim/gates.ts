/**
 * Pacing budget for the careful (STEALTH) bot. These are the numbers a balance
 * change must keep true. Widen them deliberately in a reviewed commit, never to
 * make a failing run pass. See docs/BALANCE.md.
 */
import type { SimReport } from './headlessSim';

/** Hard cap on simulated time per run. */
export const SIM_BUDGET_SEC = 10 * 3600;

export const GATES = {
  /** A careful player must be able to finish within this much active play. */
  maxHoursToVictory: 6,
  /** No phase may be so short that it is skipped, or so long that it stalls (minutes). */
  minPhaseMinutes: 8,
  maxPhaseMinutes: 120,
  /** A careful player should rarely be wiped. */
  maxWipes: 1,
  /** Most dilemmas must actually fire during a normal run. */
  minDilemmasResolved: 9,
} as const;

function phaseDurations(report: SimReport): number[] {
  const marks = Object.keys(report.phaseReachedAtSec)
    .map(Number)
    .sort((a, b) => a - b)
    .map((phase) => report.phaseReachedAtSec[phase] ?? 0);
  marks.push(report.simSeconds);
  return marks.slice(1).map((end, index) => (end - (marks[index] ?? 0)) / 60);
}

/** Returns a list of violated gates; empty means the run is within budget. */
export function checkGates(report: SimReport): string[] {
  const failures: string[] = [];
  if (!report.victory) failures.push(`did not reach victory (stopped in phase ${String(report.finalPhase)})`);
  const hours = report.simSeconds / 3600;
  if (hours > GATES.maxHoursToVictory) failures.push(`took ${hours.toFixed(2)} h (max ${String(GATES.maxHoursToVictory)})`);
  if (report.wipes > GATES.maxWipes) failures.push(`${String(report.wipes)} wipes (max ${String(GATES.maxWipes)})`);
  if (report.dilemmasResolved < GATES.minDilemmasResolved) {
    failures.push(`only ${String(report.dilemmasResolved)} dilemmas fired (min ${String(GATES.minDilemmasResolved)})`);
  }
  phaseDurations(report).forEach((duration, index) => {
    const label = `phase ${String(index + 1)} lasted ${duration.toFixed(1)} min`;
    if (duration < GATES.minPhaseMinutes) failures.push(`${label} (min ${String(GATES.minPhaseMinutes)})`);
    if (duration > GATES.maxPhaseMinutes) failures.push(`${label} (max ${String(GATES.maxPhaseMinutes)})`);
  });
  return failures;
}
