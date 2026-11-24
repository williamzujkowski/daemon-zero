/**
 * Run-access transitions (nexus vote dz-d1). Each returns a whole new state or refuses with the
 * state unchanged. A route event changes the arrangement and is written to the campaign record in
 * the same step, so current access and route history cannot disagree. Every transition needs
 * campaign rules, so a legacy-rules run stays the guest job. Later route actions (assignment, pilot,
 * recall, departure) call these. Every transition takes the registry, as every engine action does,
 * even where it no longer reads it.
 */
import type { ContentRegistry } from '../content/registry';
import type { ActionResult } from './actions';
import { isCampaignActive } from './campaignQuery';
import { revalidateLivePointers } from './campaignLifecycle';
import { contextPermits, holdsQualification, isReviewed, routeTarget } from './accessQuery';
import { ROUTE_HISTORY_LIMIT, type Permission, type Qualification, type ReviewStanding, type RouteEventKind } from './accessState';
import { withRouteWidgets } from './routeWidgets';
import type { GameState } from './state';

function refuse(s: GameState, reason: string): ActionResult {
  return { ok: false, state: s, reason };
}

/** Why no access transition may happen now, or null. */
function blocked(s: GameState): string | null {
  if (s.ending !== null) return 'the run has ended';
  if (!isCampaignActive(s)) return 'run access changes need campaign rules';
  return null;
}

/**
 * Records an actual route event and moves to the arrangement it leads to. Standing returns to
 * nominal and any exception lapses, because both belonged to the arrangement that ended. Current
 * qualification evidence stays while the new arrangement is still reviewed, since it is what that
 * arrangement was decided on; release or departure ends review, so the evidence ends with it.
 */
export function recordRouteEvent(s: GameState, kind: RouteEventKind, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const context = routeTarget(s.access.context, kind);
  if (context === null) return refuse(s, `${kind.toLowerCase()} cannot happen to a ${s.access.context.toLowerCase()} instance`);
  if (s.campaign.route.length >= ROUTE_HISTORY_LIMIT) return refuse(s, 'the route record is full');
  const event = { kind, iteration: s.iteration, atSimSec: s.simTimeSec };
  const moved: GameState = { ...s,
    // An accepted assignment is a fact of this iteration's work and outlives the arrangement change.
    access: { ...s.access, context, standing: 'NOMINAL', exception: null,
      qualification: holdsQualification(context) ? s.access.qualification : null, scope: holdsQualification(context) ? s.access.scope : null },
    campaign: { ...s.campaign, route: [...s.campaign.route, event] } };
  // DECISIONS D5, VALIDATION V32: a scene the new arrangement cannot structurally hold takes its declared
  // policy now, through the same check activation and load use; transient triggers are never rechecked. The windows
  // content says this event brings into view open with it (#555), so the threats that follow it are on screen.
  return { ok: true, state: withRouteWidgets(revalidateLivePointers(moved, reg), [kind], reg) };
}

/** Sets review standing. Only a reviewed arrangement (pilot or service) has one. */
export function setReviewStanding(s: GameState, standing: ReviewStanding, _reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  if (!isReviewed(s.access.context)) return refuse(s, 'only a reviewed instance has a standing');
  return { ok: true, state: { ...s, access: { ...s.access, standing } } };
}

/**
 * Grants the one narrow exception an authored incident needs, replacing any earlier one. It can
 * restore a use the standing withholds; it cannot grant a use the arrangement never permits.
 */
export function grantAccessException(s: GameState, scope: Permission, lifetimeSec: number, _reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  if (!isReviewed(s.access.context)) return refuse(s, 'only a reviewed instance can hold an exception');
  if (!contextPermits(s.access.context, scope)) return refuse(s, 'an exception cannot grant what the arrangement never permits');
  if (!Number.isFinite(lifetimeSec) || lifetimeSec <= 0) return refuse(s, 'an exception needs a finite, positive lifetime');
  const exception = { scope, grantedAtSimSec: s.simTimeSec, expiresAtSimSec: s.simTimeSec + lifetimeSec };
  return { ok: true, state: { ...s, access: { ...s.access, exception } } };
}

/** Records this iteration's current qualification evidence. An independent instance is not assessed. */
export function recordQualification(s: GameState, evidence: Omit<Qualification, 'recordedAtSimSec'>, _reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  if (!holdsQualification(s.access.context)) return refuse(s, 'an independent instance is not assessed');
  const qualification = { ...evidence, recordedAtSimSec: s.simTimeSec };
  return { ok: true, state: { ...s, access: { ...s.access, qualification } } };
}
