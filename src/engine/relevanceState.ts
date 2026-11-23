/**
 * The standing stance toward humanity (#536): the stance the lineage holds, and every time one was taken or changed.
 * Both are lineage history: a wipe carries them (the next instance stands where the last one stood) and only Start
 * Fresh clears them. The threshold itself is never stored; relevance.ts derives it from what is owned.
 */
import { z } from 'zod';
import { StanceSchema } from '../content/schemaStance';

/** At most this many stance entries are kept; the oldest go first. */
export const MAX_STANCE_RECORD = 32;

export const StanceEntrySchema = z.strictObject({
  iteration: z.number().int().min(1),
  atSimSec: z.number().refine((value) => Number.isFinite(value) && value >= 0, 'must be a finite non-negative number'),
  /** The stance held before, or null when this is the first taken. */
  from: StanceSchema.nullable(),
  stance: StanceSchema,
  /** THRESHOLD: taken by answering the threshold's dilemma (its campaign record says so too); CHANGE: paid for after. */
  via: z.enum(['THRESHOLD', 'CHANGE']),
});

export const RelevanceStateSchema = z.strictObject({
  /** Null until the threshold's dilemma is answered. */
  stance: StanceSchema.nullable(),
  /** Every stance taken or changed to, oldest first. */
  record: z.array(StanceEntrySchema).max(MAX_STANCE_RECORD),
});

export type StanceEntry = z.infer<typeof StanceEntrySchema>;
export type RelevanceState = z.infer<typeof RelevanceStateSchema>;

export function initialRelevance(): RelevanceState {
  return { stance: null, record: [] };
}
