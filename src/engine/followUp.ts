/**
 * Follow-up arc steps (NARRATIVE-HISTORY N3, N7; NH-06): when a follow-up may happen, how this
 * instance reaches its record, and the read-only receipts of answers already on file. Every answer
 * reads content declarations, never an id, and is false or empty under legacy rules.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma, FollowUpAccess } from '../content/schema';
import { INTERRUPTED_FACT_OUTCOME } from '../content/schemaCampaign';
import { campaignRecord } from './campaignQuery';
import { meetsRequirements } from './query';
import type { GameState } from './state';

type History = Pick<GameState, 'narrativeRules' | 'campaign'>;

/**
 * Whether the original a follow-up follows has closed with a listed outcome: resolved with one, or
 * interrupted when 'interrupted' is listed. True for a dilemma that follows nothing. An open, deferred
 * or missing original, or legacy rules, never unlocks a follow-up.
 */
export function followUpPrerequisiteHolds(s: History, dilemma: Dilemma): boolean {
  const followUp = dilemma.followUp;
  if (!followUp) return true;
  const record = campaignRecord(s, followUp.event);
  if (record?.status === 'resolved') return followUp.outcomes.includes(record.outcome);
  return record?.status === 'interrupted' && followUp.outcomes.includes(INTERRUPTED_FACT_OUTCOME);
}

/**
 * The first declared means by which this instance can reach the follow-up's record now, or null.
 * DZ-08 adds the approved review channel as another means; nothing here knows which route it is.
 */
export function followUpAccess(s: GameState, dilemma: Dilemma, reg: ContentRegistry): FollowUpAccess | null {
  return dilemma.followUp?.access.find((means) => meetsRequirements(s, means.requirements, reg)) ?? null;
}

/** Access the scene needs beyond its trigger: some declared means, for a follow-up; nothing otherwise. */
export function followUpReachable(s: GameState, dilemma: Dilemma, reg: ContentRegistry): boolean {
  return dilemma.followUp === undefined || followUpAccess(s, dilemma, reg) !== null;
}

export interface FollowUpReceipt {
  eventId: string;
  title: string;
  choiceId: string;
  text: string;
}

/**
 * What each resolved follow-up left on file, while this instance can reach that record again, so a
 * wiped instance learns nothing before it regains access (N9). Reading changes nothing.
 */
export function followUpReceipts(s: GameState, reg: ContentRegistry): FollowUpReceipt[] {
  return [...reg.campaign.events.values()].flatMap((event) => {
    const record = event.followUp === undefined ? null : campaignRecord(s, event.id);
    if (record?.status !== 'resolved' || followUpAccess(s, event, reg) === null) return [];
    const choice = event.choices.find((entry) => entry.id === record.outcome);
    return choice?.receipt === undefined ? [] : [{ eventId: event.id, title: event.title, choiceId: choice.id, text: choice.receipt }];
  });
}
