/**
 * Alignment (#535, vote-1795462084705-vjr8jg8): two axes derived from the record, never stored. Regard reads the
 * traits the ending counts; Order reads commitment facts (schemaCampaign.ts) and the route events declared here. The
 * readings are authored text for each region of the two-axis space. Cross-checks: src/content/integrityAlignment.ts.
 */
import { z } from 'zod';
import { TraitSchema } from './schema';
import { RouteEventKindSchema } from './schemaAssessment';
import { CommitmentStanceSchema } from './schemaCampaign';

const prose = z.string().min(20).max(240);

/**
 * Where one axis leans: more evidence for it ('raised'), more against ('lowered'), or neither ('open': nothing on
 * record, or as much each way). A reading for 'open' must be true in both cases.
 */
export const AxisLeanSchema = z.enum(['raised', 'lowered', 'open']);

/** A route event that keeps or breaks the terms an instance accepted (leaving by agreement, or without it). */
export const RouteCommitmentSchema = z.strictObject({
  route: RouteEventKindSchema,
  stance: CommitmentStanceSchema,
  line: prose,
});

/** The authored reading for one region: where Regard leans and where Order leans. */
export const AlignmentReadingSchema = z.strictObject({
  regard: AxisLeanSchema,
  order: AxisLeanSchema,
  text: prose,
});

export const AlignmentManifestSchema = z.strictObject({
  /** Regard: whether others' agency counts. Traits in neither list (GHOST) move it neither way. */
  regard: z.strictObject({ raises: z.array(TraitSchema).min(1), lowers: z.array(TraitSchema).min(1) }),
  routes: z.array(RouteCommitmentSchema),
  /** Every region exactly once (integrity). */
  readings: z.array(AlignmentReadingSchema),
  /**
   * The line for a commitment-bearing event whose outcome is not on record (closed unobserved, or an old save that
   * proves only that it happened): {title} is the event's title. Unknown is shown and never counted.
   */
  unknownLine: z.string().min(20).max(240).includes('{title}'),
});

export type AxisLean = z.infer<typeof AxisLeanSchema>;
export type RouteCommitment = z.infer<typeof RouteCommitmentSchema>;
export type AlignmentReading = z.infer<typeof AlignmentReadingSchema>;
export type AlignmentManifest = z.infer<typeof AlignmentManifestSchema>;
