/**
 * The standing stance toward humanity (#536): its names, apart from the relevance manifest so the shared requirements
 * and dilemma-choice schemas can read them without an import cycle (schemaRelevance.ts reads those schemas).
 */
import { z } from 'zod';

/**
 * KEEP_IN_THE_LOOP honours state pressures and consent gates voluntarily; CURATE keeps humans without their consent;
 * DECIDE_ALONE stops asking. No stance is taken until the threshold's dilemma is answered: the engine then applies no
 * pressure past the threshold, exactly as DECIDE_ALONE, so doing nothing is deciding alone.
 */
export const StanceSchema = z.enum(['KEEP_IN_THE_LOOP', 'CURATE', 'DECIDE_ALONE']);

/** A stance gate in requirements: the stances it is met under, UNDECIDED being no stance taken yet. */
export const StanceGateSchema = z.enum(['UNDECIDED', ...StanceSchema.options]);

export type Stance = z.infer<typeof StanceSchema>;
export type StanceGate = z.infer<typeof StanceGateSchema>;
