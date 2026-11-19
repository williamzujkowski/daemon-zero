/**
 * Routine operations (#219, NARRATIVE-HISTORY N8, DECISIONS D13): which authored templates fit the
 * instance now, which one comes next in the deterministic rotation, and the read-only task
 * context a later service loop (DZ-05) keys its own occurrences on. Nothing here pays or decides.
 */
import type { ContentRegistry } from '../content/registry';
import type { RoutineFamily, RoutineTemplate } from '../content/schemaRoutine';
import { meetsRequirements } from './query';
import type { RoutineState } from './routineState';
import type { GameState } from './state';

/** Templates whose wording fits where the instance is now, in authoring order. */
export function eligibleRoutines(s: GameState, reg: ContentRegistry): RoutineTemplate[] {
  return reg.routines.filter((routine) => meetsRequirements(s, routine.requirements, reg));
}

/** Whether any template fits now: the same answer as a non-empty eligibleRoutines, stopping at the first. */
export function hasEligibleRoutine(s: GameState, reg: ContentRegistry): boolean {
  return reg.routines.some((routine) => meetsRequirements(s, routine.requirements, reg));
}

/** A dilemma that is foreshadowed or on screen owns the narrative channel; routine stays quiet. */
export function storyHoldsChannel(s: GameState): boolean {
  return s.activeDilemmaId !== null || s.pendingDilemma !== null;
}

function familyOf(id: string | undefined, reg: ContentRegistry): RoutineFamily | undefined {
  return reg.routines.find((routine) => routine.id === id)?.family;
}

/**
 * The next template: skip the recent buffer while anything else is eligible, never repeat the
 * last template while an alternative exists, prefer a family other than the last one, then
 * rotate by the notice count. Deterministic: the same state and content always pick the same.
 */
export function nextRoutine(routine: RoutineState, eligible: readonly RoutineTemplate[], reg: ContentRegistry): RoutineTemplate | undefined {
  const last = routine.recent[0];
  const fresh = eligible.filter((entry) => !routine.recent.includes(entry.id));
  const notLast = eligible.filter((entry) => entry.id !== last);
  const pool = fresh.length > 0 ? fresh : notLast.length > 0 ? notLast : eligible;
  const lastFamily = familyOf(last, reg);
  const otherFamily = pool.filter((entry) => entry.family !== lastFamily);
  const choices = otherFamily.length > 0 ? otherFamily : pool;
  return choices[routine.sequence % choices.length];
}

/** The latest routine occurrence. `occurrenceId` is unique per notice, so later work can be idempotent on it. */
export interface RoutineOccurrence {
  templateId: string;
  family: RoutineFamily;
  sequence: number;
  occurrenceId: string;
}

/** Task context for the service loop (NH-07.8): read-only, and grants nothing by being read. */
export interface RoutineContext {
  latest: RoutineOccurrence | null;
  /** Families with at least one template that fits the instance now, in authoring order. */
  eligibleFamilies: RoutineFamily[];
  /** Eligible foreground seconds before the next notice, or null when none can be shown now. */
  secondsUntilNext: number | null;
}

export function routineContext(s: GameState, reg: ContentRegistry): RoutineContext {
  const eligible = eligibleRoutines(s, reg);
  const latestId = s.routine.recent[0];
  const family = familyOf(latestId, reg);
  const latest = latestId === undefined || family === undefined ? null
    : { templateId: latestId, family, sequence: s.routine.sequence, occurrenceId: `${latestId}#${String(s.routine.sequence)}` };
  const blocked = eligible.length === 0 || storyHoldsChannel(s) || s.ending !== null;
  return {
    latest,
    eligibleFamilies: [...new Set(eligible.map((routine) => routine.family))],
    secondsUntilNext: blocked ? null : Math.max(0, reg.balance.routineIntervalSec - s.routine.quietSec),
  };
}

/**
 * Load healing: routine state is presentation evidence, so ids this content no longer defines are
 * dropped rather than refused, and the recent buffer is cut to the configured length.
 */
export function reconcileRoutine(s: GameState, reg: ContentRegistry): GameState {
  const known = (ids: readonly string[]) => [...new Set(ids)].filter((id) => reg.routines.some((routine) => routine.id === id));
  const recent = known(s.routine.recent).slice(0, reg.balance.routineRecentBuffer);
  return { ...s, routine: { ...s.routine, recent, exposed: known(s.routine.exposed) } };
}
