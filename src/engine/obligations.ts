/**
 * Campaign obligations (nexus vote nh-d7; NARRATIVE-HISTORY N4, N10): whether an event a purchase
 * needs is complete in this campaign, through which of its two paths, and which decision would
 * complete it now. Completion never names a branch, and nothing here writes state.
 */
import type { ContentRegistry } from '../content/registry';
import { campaignRecord, isCampaignActive } from './campaignQuery';
import type { GameState } from './state';

type Obligated = Pick<GameState, 'narrativeRules' | 'campaign' | 'resolvedDilemmas'>;

/**
 * The one canonical completion of an obligation. 'original': the event's own record is resolved,
 * with a chosen outcome or legacy_unknown. 'review': the original closed unobserved and its recovery
 * review was resolved; the original keeps no outcome. 'current_run': legacy rules, where an
 * obligation is the current run's resolution exactly as before campaign rules.
 */
export interface ObligationReceipt {
  event: string;
  via: 'original' | 'review' | 'current_run';
  /** The occurrence whose record holds the receipt: the event itself, or its review. */
  receiptEvent: string;
  /** The receipt's recorded outcome (a choice id or legacy_unknown); null under legacy rules. */
  outcome: string | null;
}

/**
 * The receipt that completes `eventId`, or null while it is open. Without a registry no review can
 * be found, so only the original counts: the cautious reading.
 */
export function obligationReceipt(s: Obligated, eventId: string, reg?: ContentRegistry): ObligationReceipt | null {
  if (!isCampaignActive(s)) {
    return s.resolvedDilemmas.includes(eventId) ? { event: eventId, via: 'current_run', receiptEvent: eventId, outcome: null } : null;
  }
  const own = campaignRecord(s, eventId);
  if (own?.status === 'resolved') return { event: eventId, via: 'original', receiptEvent: eventId, outcome: own.outcome };
  const review = reg?.campaign.reviews.get(eventId);
  const reviewed = review === undefined ? null : campaignRecord(s, review.id);
  // Only an original closed unobserved can be completed by its review; load refuses any other pairing.
  if (review && own?.status === 'interrupted' && reviewed?.status === 'resolved') {
    return { event: eventId, via: 'review', receiptEvent: review.id, outcome: reviewed.outcome };
  }
  return null;
}

/**
 * The decision that would complete the obligation now: the original, its recovery review once the
 * original closed unobserved, or null when it is already complete. A deferred original is still the
 * original: it resumes when its access returns.
 */
export function obligationDecision(s: Obligated, eventId: string, reg: ContentRegistry): string | null {
  if (obligationReceipt(s, eventId, reg) !== null) return null;
  if (isCampaignActive(s) && campaignRecord(s, eventId)?.status === 'interrupted') return reg.campaign.reviews.get(eventId)?.id ?? null;
  return eventId;
}

/**
 * Why a save's review records cannot stand, or null. A review exists only for an original closed
 * unobserved, so a review record beside a resolved, deferred or missing original would let both
 * paths claim the one receipt (H06).
 */
export function obligationProblem(s: Pick<GameState, 'campaign'>, reg: ContentRegistry): string | null {
  for (const [eventId, review] of reg.campaign.reviews) {
    if (!Object.hasOwn(s.campaign.events, review.id)) continue;
    if (s.campaign.events[eventId]?.status !== 'interrupted') return `save records the review of "${eventId}" although its original was not closed unobserved`;
  }
  return null;
}
