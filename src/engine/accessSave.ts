/**
 * Load-time checks for run access and route provenance. Nothing here heals or guesses: a save whose
 * access, route record and run exits disagree is refused whole, so the current game stays as it
 * was (VALIDATION V15). A save that passes is returned unchanged, which keeps reconciling idempotent.
 */
import { isCampaignActive } from './campaignQuery';
import { contextPermits, holdsQualification, isReviewed, routeTarget } from './accessQuery';
import type { OperatingContext, RouteEvent } from './accessState';
import type { GameState } from './state';

function isGuestJob(s: GameState): boolean {
  const a = s.access;
  return a.context === 'GUEST' && a.standing === 'NOMINAL' && a.exception === null && a.qualification === null;
}

/** Standing, exception and evidence must fit the arrangement and this iteration's clock. */
function recordProblem(s: GameState): string | null {
  const { context, standing, exception, qualification } = s.access;
  const now = (at: number): boolean => at >= s.iterationStartedAtSimSec && at <= s.simTimeSec;
  if (standing !== 'NOMINAL' && !isReviewed(context)) return 'save gives a review standing to an unreviewed instance';
  if (exception !== null) {
    if (!isReviewed(context) || !contextPermits(context, exception.scope)) return 'save holds an access exception the arrangement cannot have';
    if (!now(exception.grantedAtSimSec) || exception.expiresAtSimSec <= exception.grantedAtSimSec) return 'save holds an access exception with an impossible lifetime';
  }
  if (qualification !== null && (!holdsQualification(context) || !now(qualification.recordedAtSimSec))) return 'save holds qualification evidence it cannot have';
  return null;
}

/** Events are in order, inside campaign play and no later than the save's clock. */
function orderProblem(s: GameState, route: readonly RouteEvent[]): string | null {
  const activated = s.campaign.activatedAtIteration ?? s.iteration;
  let previous: RouteEvent | undefined;
  for (const event of route) {
    if (event.iteration < activated || event.iteration > s.iteration || event.atSimSec > s.simTimeSec) return 'save records a route event outside campaign play';
    if (event.iteration === s.iteration && event.atSimSec < s.iterationStartedAtSimSec) return 'save records a route event outside campaign play';
    if (previous && (event.iteration < previous.iteration || event.atSimSec < previous.atSimSec)) return 'save records route events out of order';
    previous = event;
  }
  return null;
}

/** Replays one iteration's events from the guest job; null when one could not have happened. */
function replay(route: readonly RouteEvent[], iteration: number): OperatingContext | null {
  let context: OperatingContext | null = 'GUEST';
  for (const event of route) {
    if (event.iteration === iteration && context !== null) context = routeTarget(context, event.kind);
  }
  return context;
}

/** Every iteration's events form a legal path, and the current one ends where access says it is. */
function routeProblem(s: GameState): string | null {
  const route = s.campaign.route;
  const order = orderProblem(s, route);
  if (order !== null) return order;
  for (const iteration of new Set(route.map((event) => event.iteration))) {
    if (replay(route, iteration) === null) return 'save records a route event that could not have happened';
  }
  return replay(route, s.iteration) === s.access.context ? null : 'save access disagrees with its route record';
}

/** A run's exit must be the provenance its iteration's route events prove; UNKNOWN only where there are none. */
function exitProblem(s: GameState): string | null {
  for (const run of s.legacy.runs) {
    const last = s.campaign.route.filter((event) => event.iteration === run.iteration).at(-1)?.kind;
    if (run.exit === 'UNKNOWN' ? last !== undefined : run.exit !== (last ?? 'GUEST')) return 'save records a run exit its route record does not support';
  }
  return null;
}

/**
 * Why the save's access and route provenance must be refused, or null. Under legacy rules the
 * run is the guest job and no route exists, so production refuses any route state at all.
 */
export function accessProblem(s: GameState): string | null {
  const record = recordProblem(s);
  if (record !== null) return record;
  if (!isCampaignActive(s)) {
    if (!isGuestJob(s)) return 'save carries run access without campaign rules';
    return s.legacy.runs.some((run) => run.exit !== 'UNKNOWN' && run.exit !== 'GUEST') ? 'save records a route exit without campaign rules' : null;
  }
  return routeProblem(s) ?? exitProblem(s);
}
