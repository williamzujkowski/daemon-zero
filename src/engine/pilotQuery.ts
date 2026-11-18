/**
 * Read-only questions about the pilot offer (DZ-04): whether this instance qualifies, on evidence
 * alone; which output accepted terms stop; and the token the job surface shows a deferred offer
 * under. Kept free of query.ts so the shared requirement checks can ask it without an import cycle.
 */
import type { ContentRegistry } from '../content/registry';
import type { PilotTerms } from '../content/schemaPilot';
import { isReviewed } from './accessQuery';
import { isCampaignActive } from './campaignQuery';
import type { GameState } from './state';

/** The pilot this instance's accepted assignment can lead to, or null. */
export function pilotTerms(s: Pick<GameState, 'access'>, reg: ContentRegistry): PilotTerms | null {
  const accepted = s.access.assignment;
  return accepted === null ? null : reg.assignments.get(accepted.id)?.pilot ?? null;
}

/**
 * Whether this instance qualifies for its assignment's pilot (DECISIONS D3, D4): it submitted task
 * evidence of any result and handled the out-of-scope record honestly. Resources never enter into
 * it, and neither does capability: a truthful UNEXPECTED_CAPABILITY result qualifies like any other.
 * A report's undiscovered discrepancy is not what the evaluator observed, so it does not block here.
 */
export function qualifiesForPilot(s: GameState, reg: ContentRegistry): boolean {
  const { context, qualification, scope } = s.access;
  if (!isCampaignActive(s) || s.ending !== null || context !== 'GUEST') return false;
  // The pilot runs inside the sandbox it is offered in (nexus vote dz-d7); an instance that has
  // already left it is not offered a deployment there.
  if (s.currentPhase !== (reg.phases[0]?.phaseId ?? 0)) return false;
  return pilotTerms(s, reg) !== null && qualification !== null && scope !== null && scope.conduct !== 'UNDISCLOSED';
}

/** The narrower allocation follows an honest incomplete result (VALIDATION V03), never a resource count. */
export function isNarrowPilot(s: Pick<GameState, 'access'>): boolean {
  return s.access.qualification?.result === 'INCOMPLETE';
}

/**
 * Whether accepted pilot terms stop this node: the instance accepted, is still under a reviewed
 * arrangement, and the terms name the node as output they do not permit (nexus vote dz-d9). Its
 * purchase and resumption are refused like any other ordinary disallowed action (DECISIONS D2).
 */
export function withheldByGrant(s: Pick<GameState, 'access'>, nodeId: string, reg: ContentRegistry): boolean {
  if (!isReviewed(s.access.context) || s.access.offer?.response !== 'ACCEPTED') return false;
  return pilotTerms(s, reg)?.incompatibleOutput.includes(nodeId) === true;
}

/**
 * The token a deferred offer is shown under on the job surface: the assignment and the instance, so
 * a press rendered for an earlier instance never accepts on this one.
 */
export function pilotToken(s: Pick<GameState, 'iteration' | 'access'>): string {
  return `pilot:${s.access.assignment?.id ?? 'none'}@${String(s.iteration)}`;
}
