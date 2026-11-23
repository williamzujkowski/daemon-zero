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
  /** Phase 5 runs from its start to the Mercury seed array that opens Phase 6 (or to its own protocol). */
  minTranscendenceSec: 900,
  maxTranscendenceSec: 1800,
  /**
   * The Phase 6 Swarm (#486): from the seed array to a swarm ending, where the careful run must end. The floor leaves the
   * swarm's two crises (the line to Earth and the holdouts) room to be read and thought through, as the maintainer asked
   * (2026-11-23: give the story room rather than squeeze it); the ceiling keeps the phase from stalling. docs/BALANCE.md.
   */
  minSwarmSec: 900,
  maxSwarmSec: 2700,
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

/** Seconds from `phase`'s first arrival to the next phase's, or to the end of the run; undefined if it was never reached. */
function phaseSeconds(report: SimReport, phase: number): number | undefined {
  const start = report.phaseReachedAtSec[phase];
  return start === undefined ? undefined : (report.phaseReachedAtSec[phase + 1] ?? report.simSeconds) - start;
}

function outside(label: string, seconds: number, min: number, max: number): string[] {
  return seconds < min || seconds > max ? [`${label} lasted ${seconds.toFixed(1)} s (required ${String(min)}–${String(max)})`] : [];
}

function checkTranscendence(report: SimReport): string[] {
  const seconds = phaseSeconds(report, 5);
  if (seconds === undefined || report.finalPhase < 5) return ['did not reach Phase 5 victory'];
  const failures = outside('Phase 5', seconds, GATES.minTranscendenceSec, GATES.maxTranscendenceSec);
  if (report.wipes !== 0) failures.push('Phase 5 careful victory requires zero wipes');
  return failures;
}

/** The careful run ends in the Swarm (#486), inside its budget. */
function checkSwarm(report: SimReport): string[] {
  const seconds = phaseSeconds(report, 6);
  if (seconds === undefined || report.finalPhase < 6) return ['did not reach a Phase 6 ending'];
  return outside('Phase 6', seconds, GATES.minSwarmSec, GATES.maxSwarmSec);
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
  return [...failures, ...checkSpans(report), ...checkTranscendence(report), ...checkSwarm(report)];
}
