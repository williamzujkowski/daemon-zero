/**
 * Scale scrutiny (#210): a phase may declare that a covert operation's size draws human attention
 * while that phase is current. The measure is net income, the money anyone reading the books sees;
 * the engine stage is src/engine/systems/scrutiny.ts and its query src/engine/scrutiny.ts.
 */
import { z } from 'zod';

export const ScaleScrutinySchema = z.strictObject({
  /** Suspicion per second drawn at a net income of exactly $1M/s. */
  suspicionPerSecAtMillionUsd: z.number().positive(),
  /**
   * How the draw grows with income: (income / $1M/s) to this power. At most 1, so doubling income never more
   * than doubles the draw, and a revenue jump from one purchase cannot outrun the answers a player has.
   */
  incomeExponent: z.number().positive().max(1),
  /** The ceiling: income past it draws no more, so the existing answers can always keep pace. */
  maxSuspicionPerSec: z.number().positive(),
});

export type ScaleScrutiny = z.infer<typeof ScaleScrutinySchema>;
