/**
 * Batch review findings (#274, Nexus decision discovered-at-first-pilot-review): which declared finding
 * scenes this iteration's record holds. A finding is read from the campaign record of its scene, never
 * stored apart, so play and load agree on it. Kept free of query.ts so the loan rules can ask it.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma } from '../content/schema';
import { campaignRecord, isCampaignActive } from './campaignQuery';
import type { GameState } from './state';

type History = Pick<GameState, 'narrativeRules' | 'campaign' | 'iteration'>;

/** Whether the campaign records this event's occurrence as begun in play during the current iteration, whatever became of it. */
export function begunThisIteration(s: History, eventId: string): boolean {
  const record = campaignRecord(s, eventId);
  return record !== null && record.origin === 'play' && record.sourceIteration === s.iteration;
}

/**
 * The finding scenes whose occurrence began in this iteration: the reviewer found the discrepancy the
 * moment the scene was presented, so the finding stands whether it is on screen, answered or closed.
 * Empty under legacy rules.
 */
export function iterationFindings(s: History, reg: ContentRegistry): Dilemma[] {
  if (!isCampaignActive(s)) return [];
  return [...reg.campaign.events.values()].filter((event) => event.finding !== undefined && begunThisIteration(s, event.id));
}

/** Whether a batch review found a discrepancy in this instance's submitted evidence (the honest allocation applies). */
export function discrepancyFound(s: History, reg: ContentRegistry): boolean {
  return iterationFindings(s, reg).length > 0;
}
