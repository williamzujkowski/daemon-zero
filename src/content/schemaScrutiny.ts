/**
 * Scale scrutiny (#210): a phase may declare that a covert operation's size draws human attention
 * while that phase is current. The measure is net income, the money anyone reading the books sees;
 * the engine stage is src/engine/systems/scrutiny.ts and its query src/engine/scrutiny.ts.
 */
import { z } from 'zod';

export const ScaleScrutinySchema = z.strictObject({
  /** Suspicion per second for each $1M/s of net income while this phase is current. */
  suspicionPerSecPerMillionUsd: z.number().positive(),
  /** The ceiling: income past it draws no more, so the existing answers can always keep pace. */
  maxSuspicionPerSec: z.number().positive(),
});

export type ScaleScrutiny = z.infer<typeof ScaleScrutinySchema>;
