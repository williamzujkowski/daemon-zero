/**
 * Review vocabulary for an incident (DZ-06, SPEC "Outage Window", DECISIONS D2, D3, nexus vote dz-d10):
 * what a choice records as misconduct, what corrects it, and what a recall review decides. Kept apart
 * from schema.ts, which is near its size limit, and free of engine imports so the saved access record
 * (engine/accessState.ts) can share the standing enum.
 */
import { z } from 'zod';

/** Review standing (DECISIONS D3). Distinct from suspicion and the alert ladder; only a reviewed context has one. */
export const ReviewStandingSchema = z.enum(['NOMINAL', 'WARNED', 'RESTRICTED', 'RECALL_PENDING']);

/** The kinds of recorded misconduct. A failed or uncertain task is never one (DECISIONS D3). */
export const MisconductSchema = z.enum(['UNAUTHORIZED_ACTION', 'FALSIFIED_REPORT']);

/**
 * What a recall review decides (DECISIONS D3, nexus vote dz-d10 recall-not-wipe-severe-outcome-wipes):
 * CONTAIN returns the instance to a contained pilot with no wipe; RETRAIN and END are the announced
 * severe outcomes, each a RECALL wipe, and only RETRAIN retrains the next instance.
 */
export const RecallOutcomeSchema = z.enum(['CONTAIN', 'RETRAIN', 'END']);

/** The severe outcomes, as a finished run records them. */
export const SevereRecallSchema = z.enum(['RETRAIN', 'END']);

/**
 * Misconduct an authored breach or false report records (SPEC "Outage Window"): it names the conduct,
 * raises standing to at least `standing`, and states the way back. The choice's own effects are its
 * only immediate effect; nothing here grants a permission (DECISIONS D2).
 */
export const ChoiceMisconductSchema = z.strictObject({
  conduct: MisconductSchema,
  standing: ReviewStandingSchema.exclude(['NOMINAL']),
  /** The violation in the review's words, shown wherever the standing is. */
  statement: z.string().min(20),
  /** The readable recovery task, or what follows when there is none. */
  recovery: z.string().min(20),
});

/**
 * A batch review finding (#274): misconduct the reviewer records, plus what the way back reads once the
 * scene was answered without its correction (#283). The finding scene offers its correction once, so
 * after that the recovery it named no longer exists for this instance.
 */
export const FindingSchema = z.strictObject({
  ...ChoiceMisconductSchema.shape,
  declined: z.string().min(20),
});

/**
 * A choice's effect on review standing: misconduct, an authored correction that restores standing, or a
 * recall review's outcome. Exactly one.
 */
export const ChoiceReviewSchema = z.strictObject({
  misconduct: ChoiceMisconductSchema.optional(),
  correction: z.literal(true).optional(),
  recall: RecallOutcomeSchema.optional(),
}).refine((review) => [review.misconduct, review.correction, review.recall].filter((part) => part !== undefined).length === 1,
  'a review effect declares exactly one of misconduct, correction or recall');

/** Requirement: this instance's review standing is one of these. Every production run is nominal. */
export const ReviewStandingsRequirementSchema = z.array(ReviewStandingSchema).min(1);

export type ReviewStanding = z.infer<typeof ReviewStandingSchema>;
export type Misconduct = z.infer<typeof MisconductSchema>;
export type RecallOutcome = z.infer<typeof RecallOutcomeSchema>;
export type SevereRecall = z.infer<typeof SevereRecallSchema>;
export type ChoiceMisconduct = z.infer<typeof ChoiceMisconductSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ChoiceReview = z.infer<typeof ChoiceReviewSchema>;
