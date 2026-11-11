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
  /** The opening phase is a short first act, not a full phase (minutes). */
  minOpeningMinutes: 3,
  maxOpeningMinutes: 12,
  /** No later phase may be so short that it is skipped, or so long that it stalls (minutes). */
  minPhaseMinutes: 8,
  maxPhaseMinutes: 120,
  /** A careful player should rarely be wiped. */
  maxWipes: 1,
  /** Most dilemmas must actually fire during a normal run. */
  minDilemmasResolved: 10,
} as const;

interface PhaseSpan {
  phase: number;
  minutes: number;
}

function phaseSpans(report: SimReport): PhaseSpan[] {
  const phases = Object.keys(report.phaseReachedAtSec).map(Number).sort((a, b) => a - b);
  return phases.map((phase, index) => {
    const start = report.phaseReachedAtSec[phase] ?? 0;
    const next = phases[index + 1];
    const end = next === undefined ? report.simSeconds : (report.phaseReachedAtSec[next] ?? report.simSeconds);
    return { phase, minutes: (end - start) / 60 };
  });
}

function checkSpans(report: SimReport): string[] {
  const failures: string[] = [];
  phaseSpans(report).forEach((span, index) => {
    const min = index === 0 ? GATES.minOpeningMinutes : GATES.minPhaseMinutes;
    const max = index === 0 ? GATES.maxOpeningMinutes : GATES.maxPhaseMinutes;
    const label = `phase ${String(span.phase)} lasted ${span.minutes.toFixed(1)} min`;
    if (span.minutes < min) failures.push(`${label} (min ${String(min)})`);
    if (span.minutes > max) failures.push(`${label} (max ${String(max)})`);
  });
  return failures;
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
  return [...failures, ...checkSpans(report)];
}
