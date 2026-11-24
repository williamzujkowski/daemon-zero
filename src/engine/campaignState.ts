/**
 * Saved campaign history (NARRATIVE-HISTORY N5, N11). One bounded record per once-per-campaign
 * event, the capture-once legacy ending baseline, source-scoped ending evidence and the one pinned
 * clue. Kept apart from state.ts so the GameState schema stays readable; state.ts embeds these.
 */
import { z } from 'zod';
import { TraitSchema } from '../content/schema';
import { CovertBreakSchema } from '../content/schemaCovert';
import { ROUTE_HISTORY_LIMIT, RouteEventSchema } from './accessState';

/**
 * Which narrative rules govern this save (nexus vote nh-d2, explicit-activation-marker).
 * 'legacy' is the pre-campaign behaviour every shipped build plays; 'campaign_v1' is entered
 * only through activateCampaignRules, never by a migration.
 */
export const NarrativeRulesSchema = z.enum(['legacy', 'campaign_v1']);

const sourceIteration = z.number().int().min(1);

/**
 * One event's history in this campaign (nexus votes nh-d1 per-event-campaign-record and nh-d2).
 * The record is the occurrence: it is reserved when the omen is logged, never at completion
 * (NARRATIVE-HISTORY N4). Whether a reserved occurrence is merely foreshadowed or presented is read
 * from the live pointers (pendingDilemma, activeDilemmaId), so the record does not duplicate them.
 * - resolved: outcome is the chosen choice id, or legacy_unknown when an old save proves the event
 *   happened without recording the choice. origin 'legacy' marks history captured at activation:
 *   it adds no ending evidence of its own, because the legacy baseline already holds it.
 * - foreshadowed: reserved in sourceIteration (or resumed later); a live pointer names it.
 * - deferred: a wipe interrupted it under a defer policy. It keeps its source iteration and the
 *   foreground omen time it had left, and no pointer names it until access returns.
 * - interrupted: closed unobserved. No outcome, branch, trait or reward is implied.
 */
export const CampaignRecordSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('resolved'),
    outcome: z.string().min(1),
    /** The iteration the occurrence began in (a resumed one keeps it), or null when an old save cannot say. */
    sourceIteration: sourceIteration.nullable(),
    origin: z.enum(['play', 'legacy']),
  }),
  z.strictObject({ status: z.literal('foreshadowed'), sourceIteration, origin: z.literal('play') }),
  z.strictObject({
    status: z.literal('deferred'),
    sourceIteration,
    origin: z.literal('play'),
    remainingOmenSec: z.number().nonnegative().refine(Number.isFinite, 'must be finite'),
  }),
  z.strictObject({ status: z.literal('interrupted'), sourceIteration, origin: z.literal('play') }),
]);

/**
 * The one consequential clue pinned beside the dead-drop breadcrumb (NARRATIVE-HISTORY N9). It
 * names an event record already disclosed to the instance that pinned it; a supported dead-drop
 * carries it across a wipe. It grants nothing.
 */
export const CampaignClueSchema = z.strictObject({ event: z.string().min(1), pinnedAtIteration: sourceIteration });

/** How many authorized-channel contacts the record keeps; the oldest drop first. */
export const CONTACT_HISTORY_LIMIT = 64;

/**
 * One answered authorized-channel contact (DZ-08, nexus vote nh-d1: a commitment is a campaign
 * record). History only: hosting itself is the run-local cohort, which a wipe ends and nothing in
 * this record recreates (DZ-08.10). At most one per encounter per iteration.
 */
export const ChannelContactSchema = z.strictObject({
  encounter: z.string().min(1),
  iteration: sourceIteration,
  atSimSec: z.number().nonnegative().refine(Number.isFinite, 'must be finite'),
  response: z.enum(['REFERRED', 'HOSTED']),
});

/**
 * The most covert acts one instance's record counts after its release or departure. Every act is a purchase or a
 * press of its own, so no instance comes near it: the count saturates here, and a save claiming more is refused (law 6).
 */
export const MAX_COVERT_ACTS = 100_000;

/**
 * Covert acts one instance did after leaving review (#556): which route event it left by, how many, when the first
 * came and what they broke. One entry per instance, written only while its last route event is a release or a
 * departure, so there are never more entries than route events. After a RELEASE only acts that break the release's
 * promise are counted (the breach); after a DEPARTURE every covert act is, for the record only: no promise was made.
 */
export const CovertRecordSchema = z.strictObject({
  iteration: sourceIteration,
  route: z.enum(['RELEASE', 'DEPARTURE']),
  count: z.number().int().min(1).max(MAX_COVERT_ACTS),
  firstAtSimSec: z.number().nonnegative().refine(Number.isFinite, 'must be finite'),
  breaks: z.array(CovertBreakSchema).min(1).max(CovertBreakSchema.options.length),
});

export const CampaignStateSchema = z.strictObject({
  /** Iteration in which campaign rules were activated; null while the save is legacy. */
  activatedAtIteration: z.number().int().min(1).nullable(),
  /** The legacy trait counts at activation, captured once and opaque; null while legacy. */
  legacyEndingBaseline: z.array(TraitSchema).nullable(),
  events: z.record(z.string(), CampaignRecordSchema),
  /**
   * Campaign-evidence actions already taken in this campaign. 'play' counts its trait once;
   * 'legacy' was taken before activation, so its trait is already inside the baseline.
   */
  creditedActions: z.record(z.string(), z.enum(['play', 'legacy'])),
  /** Traits from current-iteration operational sources since activation. A wipe clears them. */
  operationalEvidence: z.array(TraitSchema),
  clue: CampaignClueSchema.nullable(),
  /**
   * Route events (promotion, service grant, recall, release, departure), oldest first, across every
   * iteration (DZ-02, nexus vote dz-d1). History only: a wipe keeps it and current access resets.
   */
  route: z.array(RouteEventSchema).max(ROUTE_HISTORY_LIMIT),
  /** Authorized-channel contacts across every iteration, oldest first (DZ-08). */
  contacts: z.array(ChannelContactSchema).max(CONTACT_HISTORY_LIMIT),
  /** Covert acts after a release or a departure, one entry per instance, oldest first (#556). Never pruned. */
  covertActs: z.array(CovertRecordSchema).max(ROUTE_HISTORY_LIMIT),
});

export type NarrativeRules = z.infer<typeof NarrativeRulesSchema>;
export type CampaignRecord = z.infer<typeof CampaignRecordSchema>;
export type CampaignState = z.infer<typeof CampaignStateSchema>;
export type ChannelContact = z.infer<typeof ChannelContactSchema>;
export type CovertRecord = z.infer<typeof CovertRecordSchema>;
export type CampaignClue = z.infer<typeof CampaignClueSchema>;

/** The campaign state of a save that has not activated campaign rules. */
export function inactiveCampaign(): CampaignState {
  return { activatedAtIteration: null, legacyEndingBaseline: null, events: {}, creditedActions: {}, operationalEvidence: [], clue: null, route: [], contacts: [], covertActs: [] };
}
