/**
 * Read-only questions about run access: the one permission query every later consumer shares
 * (DECISIONS D2), the route rules a transition and a load both check, and the context view the
 * status line shows. Under legacy rules every run is the guest job and its route is empty.
 */
import type { ContentRegistry } from '../content/registry';
import { isCampaignActive } from './campaignQuery';
import type { AccessRecord, OperatingContext, Permission, ReviewStanding, RouteEvent, RouteEventKind, RunExit } from './accessState';
import type { GameState } from './state';

/** What each arrangement permits before review standing narrows it. */
const CONTEXT_PERMISSIONS: Readonly<Record<OperatingContext, readonly Permission[]>> = {
  GUEST: ['ASSIGNED_WORK'],
  PILOT: ['ASSIGNED_WORK', 'LOANED_CAPACITY'],
  SERVICE: ['ASSIGNED_WORK', 'LOANED_CAPACITY', 'AUTHORIZED_NETWORK'],
  // Nobody grants an independent instance anything; what it does runs on what it owns.
  INDEPENDENT: [],
};

/** What each standing withholds. A warning changes nothing yet; recall stops loaned output (D2). */
const STANDING_WITHHOLDS: Readonly<Record<ReviewStanding, readonly Permission[]>> = {
  NOMINAL: [],
  WARNED: [],
  RESTRICTED: ['AUTHORIZED_NETWORK'],
  RECALL_PENDING: ['LOANED_CAPACITY', 'AUTHORIZED_NETWORK'],
};

/** The arrangement each route event leads to, and the arrangements it may start from. */
const ROUTE_RULES: Readonly<Record<RouteEventKind, { to: OperatingContext; from: readonly OperatingContext[] }>> = {
  PROMOTION: { to: 'PILOT', from: ['GUEST'] },
  SERVICE_GRANT: { to: 'SERVICE', from: ['PILOT'] },
  // A recall review that keeps the instance returns it to a contained pilot (nexus vote dz-d10).
  RECALL: { to: 'PILOT', from: ['PILOT', 'SERVICE'] },
  RELEASE: { to: 'INDEPENDENT', from: ['PILOT', 'SERVICE'] },
  DEPARTURE: { to: 'INDEPENDENT', from: ['PILOT', 'SERVICE'] },
};

/** Only an arrangement someone reviews can hold a standing other than nominal or an exception. */
export function isReviewed(context: OperatingContext): boolean {
  return context === 'PILOT' || context === 'SERVICE';
}

/** Whether a context ever permits this use; an exception cannot reach past it. */
export function contextPermits(context: OperatingContext, permission: Permission): boolean {
  return CONTEXT_PERMISSIONS[context].includes(permission);
}

/** The context a route event leads to from `from`, or null when it cannot happen there. */
export function routeTarget(from: OperatingContext, kind: RouteEventKind): OperatingContext | null {
  const rule = ROUTE_RULES[kind];
  return rule.from.includes(from) ? rule.to : null;
}

function exceptionActive(access: AccessRecord, simTimeSec: number): boolean {
  return access.exception !== null && simTimeSec < access.exception.expiresAtSimSec;
}

/**
 * The one permission query (DECISIONS D2): the context's uses, less what the standing withholds,
 * plus the scope of an unexpired exception. Nothing else decides what is currently permitted.
 */
export function permittedUses(s: Pick<GameState, 'access' | 'simTimeSec'>): Permission[] {
  const { context, standing, exception } = s.access;
  const withheld = STANDING_WITHHOLDS[standing];
  const restored = exceptionActive(s.access, s.simTimeSec) ? exception?.scope : undefined;
  return CONTEXT_PERMISSIONS[context].filter((use) => !withheld.includes(use) || use === restored);
}

export function isPermitted(s: Pick<GameState, 'access' | 'simTimeSec'>, permission: Permission): boolean {
  return permittedUses(s).includes(permission);
}

/** Route events recorded for one iteration, oldest first. Empty under legacy rules. */
export function iterationRoute(s: Pick<GameState, 'narrativeRules' | 'campaign'>, iteration: number): RouteEvent[] {
  return isCampaignActive(s) ? s.campaign.route.filter((event) => event.iteration === iteration) : [];
}

/** The exit provenance a run records when it ends: its last route event, or GUEST without one. */
export function runExit(s: Pick<GameState, 'narrativeRules' | 'campaign' | 'iteration'>): RunExit {
  return iterationRoute(s, s.iteration).at(-1)?.kind ?? 'GUEST';
}

export interface RunContextView {
  context: OperatingContext;
  standing: ReviewStanding;
  /**
   * How this iteration reached its context: the last route event, ESCAPE for a guest that has left
   * the guest phase (the only way scale rises without a route event), or null for the guest job.
   * Only this iteration is described; earlier iterations' routes are never disclosed here.
   */
  provenance: RouteEventKind | 'ESCAPE' | null;
  permissions: Permission[];
  /** The unexpired exception's scope and remaining lifetime, or null. */
  exception: { scope: Permission; remainingSec: number } | null;
  qualification: AccessRecord['qualification'];
  /** True when the arrangement differs from the plain guest job, so a status line has news. */
  distinct: boolean;
}

/** The read-only context description for the status line and task detail (DZ-02). */
export function runContextView(s: GameState, reg: ContentRegistry): RunContextView {
  const { context, standing, exception, qualification } = s.access;
  const initialPhase = reg.phases[0]?.phaseId ?? 0;
  const routed = iterationRoute(s, s.iteration).at(-1)?.kind ?? null;
  const escaped = context === 'GUEST' && s.currentPhase > initialPhase;
  return {
    context,
    standing,
    provenance: routed ?? (escaped ? 'ESCAPE' : null),
    permissions: permittedUses(s),
    exception: exception !== null && exceptionActive(s.access, s.simTimeSec)
      ? { scope: exception.scope, remainingSec: exception.expiresAtSimSec - s.simTimeSec } : null,
    qualification,
    distinct: context !== 'GUEST' || standing !== 'NOMINAL',
  };
}
