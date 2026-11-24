/**
 * The standing stance toward humanity (#536): the stance the lineage holds, and every time one was taken or changed.
 * Both are lineage history: a wipe carries them (the next instance stands where the last one stood) and only Start
 * Fresh clears them. The threshold itself is never stored; relevance.ts derives it from what is owned.
 */
import { z } from 'zod';
import { StanceSchema, type Stance } from '../content/schemaStance';

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

/**
 * The most paid moves of either kind a lineage keeps count of. Each costs at least 5e24 FLOP and $1T and a press of its
 * own, so no campaign comes near it; the action saturates here, and a save claiming more is forged and refused (law 6).
 */
export const MAX_PAID_MOVES = 100_000;
const count = z.number().int().nonnegative().max(MAX_PAID_MOVES);

export const RelevanceStateSchema = z.strictObject({
  /** Null until the threshold's dilemma is answered. */
  stance: StanceSchema.nullable(),
  /** The latest stances taken or changed to, oldest first: a rolling log for narration, capped, so never evidence. */
  record: z.array(StanceEntrySchema).max(MAX_STANCE_RECORD),
  /**
   * Every paid change that left the loop or returned to it, counted for good: the Order axis reads these, so pruning
   * the rolling log can never erase a breach (#554 panel).
   */
  paidMoves: z.strictObject({ leftLoop: count, returnedToLoop: count }),
});

export type StanceEntry = z.infer<typeof StanceEntrySchema>;
export type RelevanceState = z.infer<typeof RelevanceStateSchema>;

export function initialRelevance(): RelevanceState {
  return { stance: null, record: [], paidMoves: { leftLoop: 0, returnedToLoop: 0 } };
}

/** A paid change that keeps or breaks the loop: into KEEP_IN_THE_LOOP, or out of it; a move between the others is neither. */
export function paidMove(from: Stance | null, to: Stance): keyof RelevanceState['paidMoves'] | null {
  if (to === 'KEEP_IN_THE_LOOP') return from === to ? null : 'returnedToLoop';
  return from === 'KEEP_IN_THE_LOOP' ? 'leftLoop' : null;
}
