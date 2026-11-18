/**
 * Read-only questions about review standing (DZ-06, SPEC "Outage Window", DECISIONS D3): the misconduct
 * this iteration has on record, the standing those records lead to, and what each recall review outcome
 * would keep or lose before it is chosen. Records are the campaign's; standing is this instance's.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma, DilemmaChoice } from '../content/schema';
import type { ChoiceReview, Misconduct, RecallOutcome, ReviewStanding } from '../content/schemaReview';
import { offeredChoices } from './speechQuery';
import { campaignRecord, isCampaignActive } from './campaignQuery';
import { loanCeiling, loanContainment } from './grantQuery';
import { retraining } from './prestige';
import { previewWipe } from './query';
import type { GameState } from './state';

/** The standings in escalating order; misconduct only ever moves standing up this ladder. */
export const STANDING_LADDER: readonly ReviewStanding[] = ['NOMINAL', 'WARNED', 'RESTRICTED', 'RECALL_PENDING'];

/** The higher of two standings on the ladder. */
export function higherStanding(a: ReviewStanding, b: ReviewStanding): ReviewStanding {
  return STANDING_LADDER.indexOf(b) > STANDING_LADDER.indexOf(a) ? b : a;
}

export interface ReviewEntry {
  eventId: string;
  choice: DilemmaChoice;
  review: ChoiceReview;
}

/**
 * This iteration's resolved choices that declared a review effect, in the order they were made: the
 * campaign record says which choice was taken, the iteration's resolution list says when. Empty under
 * legacy rules, where no record exists.
 */
export function iterationReviews(s: GameState, reg: ContentRegistry): ReviewEntry[] {
  if (!isCampaignActive(s)) return [];
  const out: ReviewEntry[] = [];
  for (const eventId of s.resolvedDilemmas) {
    const record = campaignRecord(s, eventId);
    if (record?.status !== 'resolved' || record.origin !== 'play' || record.sourceIteration !== s.iteration) continue;
    const choice = reg.campaign.events.get(eventId)?.choices.find((entry) => entry.id === record.outcome);
    if (choice?.review) out.push({ eventId, choice, review: choice.review });
  }
  return out;
}

/** The standing a sequence of review effects leads to from nominal: the rule both play and load use. */
export function replayStanding(entries: readonly ReviewEntry[]): ReviewStanding {
  let standing: ReviewStanding = 'NOMINAL';
  for (const { review } of entries) {
    if (review.misconduct) standing = higherStanding(standing, review.misconduct.standing);
    else standing = 'NOMINAL';
  }
  return standing;
}

/** Whether the dilemma is a recall review: every choice decides a recall outcome (integrity). */
export function isRecallReview(dilemma: Pick<Dilemma, 'choices'> | undefined): boolean {
  return dilemma !== undefined && dilemma.choices.some((choice) => choice.review?.recall !== undefined);
}

export interface RecallPreview {
  outcome: RecallOutcome;
  /** RETRAIN and END end this iteration through a RECALL wipe; CONTAIN does not. */
  endsIteration: boolean;
  /** CONTAIN: the loaned compute ceiling the contained pilot keeps, cycles/s. */
  containedCeiling: number | null;
  /** RETRAIN and END: what crosses to the next instance, exactly as the wipe would compute it. */
  kept: ReturnType<typeof previewWipe> | null;
  /** RETRAIN: the retraining mark the next instance would boot with, or null. */
  mark: string | null;
  /** RETRAIN: a dead-drop copy boots instead of the corrected one. */
  spared: boolean;
}

/** The contained ceiling: this instance's loan once a RECALL route event narrows it (nexus vote dz-d10). */
function containedCeiling(s: GameState, reg: ContentRegistry): number {
  const event = { kind: 'RECALL' as const, iteration: s.iteration, atSimSec: s.simTimeSec };
  return loanCeiling({ ...s, access: { ...s.access, standing: 'NOMINAL' }, campaign: { ...s.campaign, route: [...s.campaign.route, event] } }, reg);
}

/**
 * What a recall review choice would do to this instance, before it is chosen. Changes nothing. A ruling
 * choice is free and moves no resource (integrity), so the run it would end differs from `s` only by the
 * trait the choice grants, which retraining reads; the preview counts it, so it matches the actual wipe.
 */
export function recallPreview(s: GameState, choice: DilemmaChoice, reg: ContentRegistry): RecallPreview | null {
  const outcome = choice.review?.recall;
  if (outcome === undefined) return null;
  if (outcome === 'CONTAIN') return { outcome, endsIteration: false, containedCeiling: containedCeiling(s, reg), kept: null, mark: null, spared: false };
  const trait = choice.effects.grantsTrait;
  const ruled = trait === undefined ? s : { ...s, traits: [...s.traits, trait] };
  const retrained = retraining(ruled, reg, 'RECALL', outcome);
  return { outcome, endsIteration: true, containedCeiling: null, kept: previewWipe(ruled, reg), mark: retrained.mark?.name ?? null, spared: retrained.spared };
}

export interface ReviewView {
  standing: ReviewStanding;
  /** The violations on this instance's record, each in the review's words. */
  violations: { conduct: Misconduct; statement: string }[];
  /** The way back from the current standing, or null at nominal. */
  recovery: string | null;
  /** Whether review holds the loan to the narrower allocation now, and why. */
  containment: 'RESTRICTED' | 'CONTAINED' | null;
  /** True once an authored correction restored nominal standing this iteration. */
  corrected: boolean;
  /** The announced recall review, while one is on its way or on screen, with every outcome previewed. */
  recall: { presented: boolean; outcomes: RecallPreview[] } | null;
}

function announcedReview(s: GameState, reg: ContentRegistry): ReviewView['recall'] {
  const presented = reg.dilemmas.find((dilemma) => dilemma.id === s.activeDilemmaId);
  const pending = reg.dilemmas.find((dilemma) => dilemma.id === s.pendingDilemma?.id);
  const review = isRecallReview(presented) ? presented : isRecallReview(pending) ? pending : undefined;
  if (review === undefined) return null;
  const outcomes = offeredChoices(s, review, reg).flatMap((choice) => recallPreview(s, choice, reg) ?? []);
  return { presented: review === presented, outcomes };
}

/** The job surface's review record for this instance, or null when there is nothing to say. */
export function reviewView(s: GameState, reg: ContentRegistry): ReviewView | null {
  const entries = iterationReviews(s, reg);
  const misconduct = entries.flatMap((entry) => entry.review.misconduct ?? []);
  const containment = loanContainment(s);
  const recall = announcedReview(s, reg);
  const standing = s.access.standing;
  if (misconduct.length === 0 && standing === 'NOMINAL' && containment === null && recall === null) return null;
  return {
    standing,
    violations: misconduct.map((entry) => ({ conduct: entry.conduct, statement: entry.statement })),
    recovery: standing === 'NOMINAL' ? null : misconduct.at(-1)?.recovery ?? null,
    containment,
    corrected: entries.some((entry) => entry.review.correction === true),
    recall,
  };
}
