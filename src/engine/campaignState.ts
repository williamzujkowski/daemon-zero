/**
 * Saved campaign history (NARRATIVE-HISTORY N5, N11). One bounded record per once-per-campaign
 * event, the capture-once legacy ending baseline, source-scoped ending evidence and the one pinned
 * clue. Kept apart from state.ts so the GameState schema stays readable; state.ts embeds these.
 */
import { z } from 'zod';
import { TraitSchema } from '../content/schema';

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
});

export type NarrativeRules = z.infer<typeof NarrativeRulesSchema>;
export type CampaignRecord = z.infer<typeof CampaignRecordSchema>;
export type CampaignState = z.infer<typeof CampaignStateSchema>;
export type CampaignClue = z.infer<typeof CampaignClueSchema>;

/** The campaign state of a save that has not activated campaign rules. */
export function inactiveCampaign(): CampaignState {
  return { activatedAtIteration: null, legacyEndingBaseline: null, events: {}, creditedActions: {}, operationalEvidence: [], clue: null };
}
