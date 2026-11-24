/**
 * Who you are becoming (#535, vote-1795462084705-vjr8jg8): two axes derived from the record, never stored. Regard
 * counts the traits the ending counts (endingEvidence, so campaign evidence counts once across wipes); Order counts
 * the commitment facts that hold, the route events content declares and each release's terms kept or broken (#556).
 * An unknown outcome is listed, never counted.
 */
import type { ContentRegistry } from '../content/registry';
import type { Trait } from '../content/schema';
import type { AxisLean } from '../content/schemaAlignment';
import { LEGACY_UNKNOWN_OUTCOME, type CampaignFact, type Commitment, type CommitmentStance } from '../content/schemaCampaign';
import { campaignRecord, endingEvidence, holdsCampaignFact, isCampaignActive, releaseTermsInstances } from './campaignQuery';
import type { GameState } from './state';

type AlignmentSource = Pick<GameState, 'narrativeRules' | 'campaign' | 'traits' | 'relevance'>;

/** One Regard line: how many times the ending evidence holds this trait, and which way it moves the axis. */
export interface RegardEvidence { trait: Trait; direction: 'raises' | 'lowers'; count: number }

/**
 * One Order line: a commitment kept or broken, or a commitment-bearing outcome that is not on record. `count` is set on
 * an aggregate line (paid stance moves, #536): it stands for that many commitments, so a lasting total is one object.
 */
export interface OrderEvidence { stance: CommitmentStance | 'unknown'; text: string; count?: number }

export interface AlignmentAxis<E> {
  /** Evidence for the axis (Regard: others count; Order: a commitment kept) and against it. */
  raises: number;
  lowers: number;
  /** (raises - lowers) / (raises + lowers), from -1 to 1; null when nothing on record moves it. */
  value: number | null;
  lean: AxisLean;
  evidence: readonly E[];
}

export interface AlignmentView {
  regard: AlignmentAxis<RegardEvidence>;
  /** `unknown` counts the outcomes listed as not on record; they move nothing. */
  order: AlignmentAxis<OrderEvidence> & { unknown: number };
  /** The authored reading for the region the two leans name. */
  reading: string;
  /** Whether anything on record speaks to either axis, an unknown outcome included. */
  hasEvidence: boolean;
}

function axis<E>(raises: number, lowers: number, evidence: readonly E[]): AlignmentAxis<E> {
  const total = raises + lowers;
  const value = total === 0 ? null : (raises - lowers) / total;
  const lean: AxisLean = value === null || value === 0 ? 'open' : value > 0 ? 'raised' : 'lowered';
  return { raises, lowers, value, lean, evidence };
}

function regardAxis(s: AlignmentSource, reg: ContentRegistry): AlignmentAxis<RegardEvidence> {
  const held = endingEvidence(s, reg);
  const lines = (traits: readonly Trait[], direction: RegardEvidence['direction']): RegardEvidence[] => traits
    .map((trait) => ({ trait, direction, count: held.filter((entry) => entry === trait).length }))
    .filter((line) => line.count > 0);
  const evidence = [...lines(reg.alignment.regard.raises, 'raises'), ...lines(reg.alignment.regard.lowers, 'lowers')];
  const sum = (direction: RegardEvidence['direction']) => evidence.filter((line) => line.direction === direction).reduce((n, line) => n + line.count, 0);
  return axis(sum('raises'), sum('lowers'), evidence);
}

/** A commitment counts only where its promise was made: no promise named, or the promise fact holds. */
function promiseHolds(s: AlignmentSource, fact: { commitment?: Commitment | undefined }, reg: ContentRegistry): boolean {
  const promise = fact.commitment?.promise;
  return promise === undefined || holdsCampaignFact(s, promise, reg);
}

/** Whether this event's occurrence ended with no known choice: closed unobserved, or proven only to have happened. */
function outcomeUnknown(s: AlignmentSource, eventId: string): boolean {
  const record = campaignRecord(s, eventId);
  return record?.status === 'interrupted' || (record?.status === 'resolved' && record.outcome === LEGACY_UNKNOWN_OUTCOME);
}

function unknownLines(s: AlignmentSource, facts: readonly CampaignFact[], reg: ContentRegistry): OrderEvidence[] {
  const events = [...new Set(facts.filter((fact) => promiseHolds(s, fact, reg)).map((fact) => fact.event))];
  return events.filter((eventId) => outcomeUnknown(s, eventId)).map((eventId) => ({
    stance: 'unknown' as const,
    text: reg.alignment.unknownLine.replace('{title}', reg.campaign.events.get(eventId)?.title ?? eventId),
  }));
}

/**
 * Paid stance changes (#536) that left the loop or returned to it, counted where their promise was made. Each kind is one
 * aggregate line carrying its lasting total, never one object per move: the totals come from the save, which is untrusted
 * input (law 6). The first stance is the threshold dilemma's record, read through its commitment facts above.
 */
function stanceChangeLines(s: AlignmentSource, reg: ContentRegistry): OrderEvidence[] {
  const { leftLoop, returnedToLoop } = s.relevance.paidMoves;
  return ([['LEAVE_LOOP', leftLoop], ['RETURN_TO_LOOP', returnedToLoop]] as const).flatMap(([move, times]): OrderEvidence[] => {
    const rule = reg.alignment.stanceChanges.find((change) => change.move === move);
    if (rule === undefined || times === 0 || (rule.promise !== undefined && !holdsCampaignFact(s, rule.promise, reg))) return [];
    return [{ stance: rule.stance, text: rule.line, count: times }];
  });
}

/**
 * A release's terms (#556): kept for each instance released by agreement with no breach on record, broken for each with
 * one. One line per fact carrying how many instances it stands for, like a route event counted per instance.
 */
function releaseTermsLines(s: AlignmentSource, reg: ContentRegistry): OrderEvidence[] {
  if (!isCampaignActive(s)) return [];
  return [...reg.campaign.releaseTermsFacts.values()].flatMap((fact): OrderEvidence[] => {
    const times = releaseTermsInstances(s.campaign, fact.releaseTerms);
    if (fact.commitment === undefined || times === 0 || !promiseHolds(s, fact, reg)) return [];
    return [{ stance: fact.commitment.stance, text: fact.commitment.line, ...(times > 1 ? { count: times } : {}) }];
  });
}

function orderAxis(s: AlignmentSource, reg: ContentRegistry): AlignmentView['order'] {
  const facts = [...reg.campaign.facts.values()].filter((fact) => fact.commitment !== undefined);
  const recorded = facts.flatMap((fact): OrderEvidence[] => fact.commitment !== undefined && holdsCampaignFact(s, fact.id, reg) && promiseHolds(s, fact, reg)
    ? [{ stance: fact.commitment.stance, text: fact.commitment.line }] : []);
  // Route events exist only under campaign rules; each is its own instance's act, so each counts.
  const routes = isCampaignActive(s) ? s.campaign.route.flatMap((event): OrderEvidence[] => {
    const entry = reg.alignment.routes.find((route) => route.route === event.kind);
    return entry === undefined ? [] : [{ stance: entry.stance, text: entry.line }];
  }) : [];
  const counted = [...recorded, ...routes, ...releaseTermsLines(s, reg), ...stanceChangeLines(s, reg)];
  const unknown = unknownLines(s, facts, reg);
  const count = (stance: CommitmentStance) => counted.reduce((sum, line) => sum + (line.stance === stance ? line.count ?? 1 : 0), 0);
  return { ...axis(count('kept'), count('broken'), [...counted, ...unknown]), unknown: unknown.length };
}

/**
 * The two axes, the evidence behind each and the authored reading for where they lean. Pure and derived: the same
 * record always reads the same, and a new record changes it as soon as it exists.
 */
export function alignmentView(s: AlignmentSource, reg: ContentRegistry): AlignmentView {
  const regard = regardAxis(s, reg);
  const order = orderAxis(s, reg);
  const reading = reg.alignment.readings.find((entry) => entry.regard === regard.lean && entry.order === order.lean)?.text ?? '';
  const hasEvidence = regard.evidence.length > 0 || order.evidence.length > 0;
  return { regard, order, reading, hasEvidence };
}
