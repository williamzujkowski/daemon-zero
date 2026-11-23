/**
 * The hostile-mind slot (#491): its own lifecycle beside the single wild-encounter slot, so a hostile arrival never
 * displaces a lesser mind's offer and the two are scheduled apart. The rules that read and write it are in hostile.ts.
 */
import { z } from 'zod';

const finite = z.number().refine(Number.isFinite, 'must be finite');
const nonNegative = finite.refine((value) => value >= 0, 'must be >= 0');
const count = z.number().int().nonnegative();

/** The hostile mind pressing this instance now. */
export const ActiveHostileSchema = z.strictObject({
  id: z.string(),
  arrivedAtSec: nonNegative,
  /** Live seconds neither trigger has held, since one last held; it lapses at the balance's quietLapseSec. */
  quietSec: nonNegative,
  /** Live seconds a decoy still holds its effect off; 0 when no decoy is out. */
  decoySec: nonNegative,
  /** Bytes a rival pinned (added to memoryUsed), returned whenever it lets go; 0 for any other type. */
  pinnedBytes: nonNegative,
});

export const HostileStateSchema = z.strictObject({
  active: ActiveHostileSchema.nullable(),
  /** Simulated second from which the next hostile may arrive. */
  nextAtSec: nonNegative,
  /** Arrivals so far: the deterministic rotation's position. A wipe keeps it, as it keeps the wild rotation. */
  sequence: count,
  /** Purge attempts so far: the purge's deterministic outcome reads it. A wipe keeps it. */
  purges: count,
});

export type ActiveHostile = z.infer<typeof ActiveHostileSchema>;
export type HostileState = z.infer<typeof HostileStateSchema>;

export function initialHostile(): HostileState {
  return { active: null, nextAtSec: 0, sequence: 0, purges: 0 };
}
