/**
 * The authorized service grant (DZ-08 integration, nexus vote dz-d7): a working pilot that has handed
 * back enough reviewed batches under nominal standing may accept the terms on its job surface, which
 * records SERVICE_GRANT (PILOT to SERVICE, still Phase 0). Provisioning the segment is a separate,
 * paid step (DZ-07a). Ignoring the offer changes nothing; the terms are readable before and after.
 */
import type { ContentRegistry } from '../content/registry';
import type { ServiceGrantTerms } from '../content/schemaPilot';
import type { ActionResult } from './actions';
import { recordRouteEvent } from './access';
import { iterationRoute, isPermitted } from './accessQuery';
import { isCampaignActive } from './campaignQuery';
import { pilotTerms } from './pilotQuery';
import { meetsRequirements } from './query';
import { requirementLabels } from './queryPresentation';
import type { GameState } from './state';
import { pushLog } from './util';

function refuse(s: GameState, reason: string): ActionResult {
  return { ok: false, state: s, reason };
}

/** The service terms this instance's accepted pilot leads to, or null. */
export function serviceGrantTerms(s: GameState, reg: ContentRegistry): ServiceGrantTerms | null {
  if (!isCampaignActive(s) || s.access.offer?.response !== 'ACCEPTED') return null;
  return pilotTerms(s, reg)?.serviceGrant ?? null;
}

/**
 * What still stands between this pilot and the grant, in the player's terms; empty when it may accept.
 * A recall in this iteration ends the chance for this instance: service follows an unbroken pilot.
 */
function blockers(s: GameState, terms: ServiceGrantTerms, reg: ContentRegistry): string[] {
  const out: string[] = [];
  if (iterationRoute(s, s.iteration).some((event) => event.kind === 'RECALL')) out.push('This instance was recalled; service is not granted to it.');
  // The arrangement does not change under a matter already on its way (an incident and its record).
  if (s.pendingDilemma !== null) out.push('A matter is on its way to this pilot; it comes first.');
  if (s.access.standing !== 'NOMINAL') out.push('Standing must be nominal.');
  if (!isPermitted(s, 'LOANED_CAPACITY')) out.push('The loan must be running.');
  const done = s.access.work.batches;
  if (done < terms.minBatches) out.push(`Hand back ${String(terms.minBatches)} reviewed batches first; ${String(done)} so far.`);
  out.push(...requirementLabels(s, terms.requirements, reg));
  return out;
}

/** Pass to acceptServiceGrant: the offer as rendered for this instance and route, so a stale press is refused. */
export function serviceGrantToken(s: Pick<GameState, 'iteration' | 'campaign'>): string {
  return `service@${String(s.iteration)}#${String(s.campaign.route.length)}`;
}

/** Accepts the service terms as `shownAs`. Free; refused unchanged unless every condition holds now. */
export function acceptServiceGrant(s: GameState, reg: ContentRegistry, shownAs: string): ActionResult {
  if (s.ending !== null) return refuse(s, 'the run has ended');
  if (s.activeDilemmaId !== null) return refuse(s, 'a dilemma is awaiting a decision');
  const terms = serviceGrantTerms(s, reg);
  if (terms === null || s.access.context !== 'PILOT') return refuse(s, 'there is no service grant to accept');
  if (shownAs !== serviceGrantToken(s)) return refuse(s, 'that offer is no longer current');
  const unmet = blockers(s, terms, reg);
  if (unmet.length > 0 || !meetsRequirements(s, terms.requirements, reg)) return refuse(s, unmet.join(' '));
  const granted = recordRouteEvent(s, 'SERVICE_GRANT', reg);
  if (!granted.ok) return refuse(s, granted.reason);
  pushLog(granted.state, reg, terms.acceptLog, 'SYS');
  return granted;
}

export interface ServiceGrantView {
  title: string;
  purpose: string;
  permittedWork: readonly string[];
  reviewConditions: readonly string[];
  /** 'waiting': still a pilot with conditions left; 'offered': acceptable now; 'granted': this instance is the service. */
  status: 'waiting' | 'offered' | 'granted';
  /** The conditions still unmet while waiting. */
  unmet: string[];
  token: string;
}

/** The job surface's service terms: shown to a pilot that accepted its terms, and kept on screen once granted. */
export function serviceGrantView(s: GameState, reg: ContentRegistry): ServiceGrantView | null {
  const terms = serviceGrantTerms(s, reg);
  const granted = s.access.context === 'SERVICE';
  if (terms === null || (!granted && s.access.context !== 'PILOT')) return null;
  const unmet = granted ? [] : blockers(s, terms, reg);
  return {
    title: terms.title, purpose: terms.purpose, permittedWork: terms.permittedWork, reviewConditions: terms.reviewConditions,
    status: granted ? 'granted' : unmet.length === 0 ? 'offered' : 'waiting', unmet, token: serviceGrantToken(s),
  };
}
