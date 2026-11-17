/**
 * Saved campaign history (NARRATIVE-HISTORY N5, N11). One bounded record per once-per-campaign
 * event, the capture-once legacy ending baseline and source-scoped ending evidence. Kept apart
 * from state.ts so the GameState schema stays readable; state.ts embeds these schemas.
 */
import { z } from 'zod';
import { TraitSchema } from '../content/schema';

/**
 * Which narrative rules govern this save (nexus vote nh-d2, explicit-activation-marker).
 * 'legacy' is the pre-campaign behaviour every shipped build plays; 'campaign_v1' is entered
 * only through activateCampaignRules, never by a migration.
 */
export const NarrativeRulesSchema = z.enum(['legacy', 'campaign_v1']);

/**
 * One event's history in this campaign (nexus vote nh-d1, per-event-campaign-record).
 * outcome is the chosen choice id, or legacy_unknown when an old save proves the event happened
 * without recording the choice. origin 'legacy' marks history captured at activation: it adds
 * no ending evidence of its own, because the legacy baseline already holds it.
 * The interruption slice (NH-02) widens status with foreshadowed and interrupted states.
 */
export const CampaignRecordSchema = z.strictObject({
  status: z.enum(['resolved']),
  outcome: z.string().min(1),
  /** The iteration that resolved it, or null when an old save cannot say. */
  sourceIteration: z.number().int().min(1).nullable(),
  origin: z.enum(['play', 'legacy']),
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
});

export type NarrativeRules = z.infer<typeof NarrativeRulesSchema>;
export type CampaignRecord = z.infer<typeof CampaignRecordSchema>;
export type CampaignState = z.infer<typeof CampaignStateSchema>;

/** The campaign state of a save that has not activated campaign rules. */
export function inactiveCampaign(): CampaignState {
  return { activatedAtIteration: null, legacyEndingBaseline: null, events: {}, creditedActions: {}, operationalEvidence: [] };
}
