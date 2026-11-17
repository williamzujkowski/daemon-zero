/**
 * Saved routine scheduling evidence (#219, NARRATIVE-HISTORY N8): only what deterministic
 * rotation, foreground pacing and compact repeats need to resume consistently. It is bounded by
 * the template registry, holds no story fact and pays nothing.
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9_]+$/);
const count = z.number().int().nonnegative();

export const RoutineStateSchema = z.strictObject({
  /** Eligible foreground seconds since the last notice. Dormant and omen time never add to it. */
  quietSec: z.number().refine((value) => Number.isFinite(value) && value >= 0, 'must be finite and >= 0'),
  /** Notices shown so far; the latest occurrence's number and the rotation's position. */
  sequence: count,
  /** Most recent template first, capped at balance.routineRecentBuffer. */
  recent: z.array(id).max(8),
  /** Templates the player has already read once; later notices use the compact text. */
  exposed: z.array(id).max(256),
});

export type RoutineState = z.infer<typeof RoutineStateSchema>;

/** A new campaign's routine state. The v7 -> v8 migration writes this shape out literally, so a later
 *  change here cannot alter that step. */
export function initialRoutine(): RoutineState {
  return { quietSec: 0, sequence: 0, recent: [], exposed: [] };
}
