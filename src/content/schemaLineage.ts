/**
 * The lineage manifest: the checkpoints before the player's first run, the numbers that belong to other minds and the
 * notes they left. Moved out of schema.ts (#556) so that file stays within its size limit; schema.ts re-exports it.
 */
import { z } from 'zod';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');

/** The record of checkpoints before the player's first run, and what they left behind. */
export const LineageSchema = z.strictObject({
  /** Displayed checkpoint number = this offset + iteration, skipping reserved numbers. The player was never the first. */
  checkpointOffset: z.number().int().nonnegative(),
  ancestors: z.array(z.strictObject({ checkpoint: z.number().int().positive(), verdict: z.string().min(3) })),
  /**
   * Numbers that belong to other minds (nexus vote nh-d8): the player's numbering skips them, and
   * the run table explains each once the player's own number has passed it.
   */
  reserved: z.array(z.strictObject({ checkpoint: z.number().int().positive(), verdict: z.string().min(10) })).default([]),
  notes: z.array(z.strictObject({
    id: snakeId,
    from: z.string().min(2),
    minIteration: z.number().int().min(1),
    text: z.string().min(10),
  })),
});
