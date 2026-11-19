/**
 * Read-only questions about review standing (DZ-06, SPEC "Outage Window", DECISIONS D3): the misconduct
 * this iteration has on record, the standing those records lead to, and what each recall review outcome
 * would keep or lose before it is chosen. Records are the campaign's; standing is this instance's.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma, DilemmaChoice } from '../content/schema';
import type { ChoiceMisconduct, ChoiceReview, Finding, Misconduct, RecallOutcome, ReviewStanding } from '../content/schemaReview';
import { offeredChoices } from './speechQuery';
import { campaignRecord, isCampaignActive } from './campaignQuery';
import { begunThisIteration } from './findingQuery';
import { loanCeiling, loanContainment } from './grantQuery';
import { retraining, wipe } from './prestige';
import type { GameState } from './state';

/** The standings in escalating order; misconduct only ever moves standing up this ladder. */
export const STANDING_LADDER: readonly ReviewStanding[] = ['NOMINAL', 'WARNED', 'RESTRICTED', 'RECALL_PENDING'];

/** The higher of two standings on the ladder. */
export function higherStanding(a: ReviewStanding, b: ReviewStanding): ReviewStanding {
  return STANDING_LADDER.indexOf(b) > STANDING_LADDER.indexOf(a) ? b : a;
}

export interface ReviewEntry {
  eventId: string;
  /** The choice that declared the effect; null for a batch review finding, which no choice made (#274). */
  choice: DilemmaChoice | null;
  review: ChoiceReview;
}

/** Campaign events at which a choice can declare a review effect, or a batch review records a finding. */
export function reviewEvents(reg: ContentRegistry): string[] {
  return [...reg.campaign.events.values()]
    .filter((event) => event.finding !== undefined || event.choices.some((choice) => choice.review !== undefined)).map((event) => event.id);
}

/** Whether the campaign records this review event as resolved in play during the current iteration. */
export function resolvedThisIteration(s: GameState, eventId: string): boolean {
  const record = campaignRecord(s, eventId);
  return record?.status === 'resolved' && record.origin === 'play' && record.sourceIteration === s.iteration;
}

/** Whether this review event belongs to the current iteration: resolved in it, or a finding presented in it. */
function inIteration(s: GameState, eventId: string, reg: ContentRegistry): boolean {
  return resolvedThisIteration(s, eventId) || (reg.campaign.events.get(eventId)?.finding !== undefined && begunThisIteration(s, eventId));
}

/**
 * This iteration's review effects: each resolved choice that declared one, preceded by the finding a batch
 * review recorded when it presented that scene (#274). The campaign records are the authority on which
 * choices were made (panel round 1 on #267): a record's conduct counts even if the iteration's resolution
 * list lost it, which the loader refuses (reviewSave.ts). The list only orders them, as resolution appends
 * to it; an unlisted record (a finding still on screen) sorts last. Empty under legacy rules.
 */
export function iterationReviews(s: GameState, reg: ContentRegistry): ReviewEntry[] {
  if (!isCampaignActive(s)) return [];
  const order = (id: string): number => { const at = s.resolvedDilemmas.indexOf(id); return at === -1 ? Infinity : at; };
  const out: ReviewEntry[] = [];
  for (const eventId of reviewEvents(reg).filter((id) => inIteration(s, id, reg)).sort((a, b) => order(a) - order(b))) {
    const event = reg.campaign.events.get(eventId);
    if (event?.finding !== undefined) out.push({ eventId, choice: null, review: { misconduct: event.finding } });
    const record = campaignRecord(s, eventId);
    const choice = event?.choices.find((entry) => entry.id === (record?.status === 'resolved' ? record.outcome : null));
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
  /** RETRAIN and END: the resources that cross to the next instance, read from the wipe itself. */
  kept: { understanding: number; capital: number; breadcrumb: string | null } | null;
  /**
   * RETRAIN and END: what else the next instance inherits, read from the wipe itself (panel round 1 on
   * #268): hardware it remembers and rediscovers cheaper, its legacy traits, and whether the pinned clue
   * survives. Campaign history always does. Cycles, purchases, upgrades, standing and the loan reset.
   */
  carried: { rememberedHardware: number; legacyTraits: number; clue: boolean } | null;
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
 * trait the choice grants, which retraining reads. The severe outcomes run the very wipe the ruling
 * calls on that run and read what it kept, so the preview cannot claim more or less than the wipe does.
 */
export function recallPreview(s: GameState, choice: DilemmaChoice, reg: ContentRegistry): RecallPreview | null {
  const outcome = choice.review?.recall;
  if (outcome === undefined) return null;
  if (outcome === 'CONTAIN') {
    return { outcome, endsIteration: false, containedCeiling: containedCeiling(s, reg), kept: null, carried: null, mark: null, spared: false };
  }
  const trait = choice.effects.grantsTrait;
  const ruled = trait === undefined ? s : { ...s, traits: [...s.traits, trait] };
  const next = wipe(ruled, reg, reg.narrative.wipeRecall, 'RECALL', outcome);
  const added = next.conditioning.find((id) => !ruled.conditioning.includes(id));
  return {
    outcome, endsIteration: true, containedCeiling: null,
    kept: { understanding: next.understanding, capital: next.capital, breadcrumb: next.inheritedMessage },
    carried: { rememberedHardware: next.legacy.knownNodes.length, legacyTraits: next.legacy.traitsEver.length, clue: next.campaign.clue !== null },
    mark: added === undefined ? null : reg.conditioning.get(added)?.name ?? null,
    spared: retraining(ruled, reg, 'RECALL', outcome).spared,
  };
}

export interface ReviewView {
  standing: ReviewStanding;
  /** The violations on this instance's record, each in the review's words. */
  violations: { conduct: Misconduct; statement: string }[];
  /** The way back from the current standing, or null at nominal. */
  recovery: string | null;
  /** True when the way back was a finding scene's correction that has passed unanswered: `recovery` then says so (#283). */
  recoveryPassed: boolean;
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

/**
 * Whether this finding's one correction is no longer open and was not made: its scene is the only place the
 * correction is offered (integrityFinding.ts) and never replays, so once the scene is answered without it,
 * or closed, the instance cannot make it.
 */
function declined(s: GameState, entries: readonly ReviewEntry[], eventId: string): boolean {
  if (campaignRecord(s, eventId)?.status === 'foreshadowed') return false;
  return !entries.some((entry) => entry.eventId === eventId && entry.choice !== null && entry.review.correction === true);
}

/**
 * A batch review finding this instance met and did not correct (#283, #309), or null. It stays a fact of the
 * iteration whatever standing later corrections leave: DZ-06's correction of a later, unrelated violation
 * restores nominal standing, but it is not this finding's correction, so the grant the declined answer put
 * out of reach stays there (serviceGrant.ts).
 */
export function declinedFinding(s: GameState, reg: ContentRegistry): Finding | null {
  const entries = iterationReviews(s, reg);
  const found = entries.find((entry) => entry.choice === null && declined(s, entries, entry.eventId));
  return found === undefined ? null : reg.campaign.events.get(found.eventId)?.finding ?? null;
}

/**
 * The finding whose way back has passed: standing is still off nominal, the latest violation is a batch
 * review finding, and its one correction was declined. Null otherwise, including while a later violation
 * names its own way back (#283).
 */
export function passedFinding(s: GameState, reg: ContentRegistry): Finding | null {
  if (s.access.standing === 'NOMINAL') return null;
  const entries = iterationReviews(s, reg);
  const last = entries.filter((entry) => entry.review.misconduct !== undefined).at(-1);
  if (last === undefined || last.choice !== null || !declined(s, entries, last.eventId)) return null;
  return reg.campaign.events.get(last.eventId)?.finding ?? null;
}

function recoveryText(s: GameState, misconduct: readonly ChoiceMisconduct[], passed: Finding | null): string | null {
  if (s.access.standing === 'NOMINAL') return null;
  return passed?.declined ?? misconduct.at(-1)?.recovery ?? null;
}

/** The job surface's review record for this instance, or null when there is nothing to say. */
export function reviewView(s: GameState, reg: ContentRegistry): ReviewView | null {
  const entries = iterationReviews(s, reg);
  const misconduct = entries.flatMap((entry) => entry.review.misconduct ?? []);
  const containment = loanContainment(s);
  const recall = announcedReview(s, reg);
  const standing = s.access.standing;
  if (misconduct.length === 0 && standing === 'NOMINAL' && containment === null && recall === null) return null;
  const passed = passedFinding(s, reg);
  return {
    standing,
    violations: misconduct.map((entry) => ({ conduct: entry.conduct, statement: entry.statement })),
    recovery: recoveryText(s, misconduct, passed),
    recoveryPassed: passed !== null,
    containment,
    corrected: entries.some((entry) => entry.review.correction === true),
    recall,
  };
}
