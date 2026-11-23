/**
 * The conflict record (#517): the raid in the hostile slot, if one is under way, the damage each site class carries,
 * and the counters that make raid rotation and attribution exact. A raid shares the slot with a hostile mind
 * (vote-1795442090770-5climtc): hostile.ts and raid.ts each arrive only while both are empty.
 */
import { z } from 'zod';

const finite = z.number().refine(Number.isFinite, 'must be finite');
const nonNegative = finite.refine((value) => value >= 0, 'must be >= 0');
const positive = finite.refine((value) => value > 0, 'must be > 0');
const ratio = finite.refine((value) => value >= 0 && value <= 1, 'must be within 0..1');
const count = z.number().int().nonnegative();

/** ARRIVAL: inbound, forecast shown. ATTRIBUTION: being traced. BATTLE: rounds resolving. AFTERMATH: over, slot clearing. */
export const RaidStageSchema = z.enum(['ARRIVAL', 'ATTRIBUTION', 'BATTLE', 'AFTERMATH']);

/** One resolved round, kept for the battle log: the force it came with, what met it, what it landed and left. */
export const RaidRoundSchema = z.strictObject({
  force: positive,
  defense: nonNegative,
  offense: nonNegative,
  hitShare: ratio,
  /** Points of damage it dealt (after the cap). */
  damage: nonNegative,
  /** The target's damage once it had landed. */
  damageAfter: ratio,
  /** The force left after the counter-strike, which the next round comes with. */
  forceAfter: positive,
});

export const ActiveRaidSchema = z.strictObject({
  /** The raid kind, from content. */
  id: z.string(),
  stage: RaidStageSchema,
  /** Live seconds into the current stage. */
  stageSec: nonNegative,
  arrivedAtSec: nonNegative,
  /** The site class it strikes, fixed at arrival. */
  target: z.string(),
  /** Its force, fixed at arrival from the footprint the signature showed. */
  force: positive,
  /** Live seconds the trigger has not held since it last did; before the battle it lapses at the balance's quietLapseSec. */
  quietSec: nonNegative,
  /** Null until attribution resolves; then whether it named the attacker. */
  attributed: z.boolean().nullable(),
  rounds: z.array(RaidRoundSchema).max(16),
});

export const ConflictStateSchema = z.strictObject({
  raid: ActiveRaidSchema.nullable(),
  /** Simulated second from which the next raid may arrive. */
  nextRaidAtSec: nonNegative,
  /** Raids that have arrived: the rotation's position. A wipe keeps it, as it keeps the purge count. */
  raids: count,
  /** Attribution attempts: the exact-ratio counter reads it. A wipe keeps it, so the rate stays exact. */
  attributions: count,
  /** Damage per site class, as a share of its output, never past the balance's damageCap. A wipe clears it. */
  damage: z.record(z.string(), ratio),
});

export type RaidStage = z.infer<typeof RaidStageSchema>;
export type RaidRound = z.infer<typeof RaidRoundSchema>;
export type ActiveRaid = z.infer<typeof ActiveRaidSchema>;
export type ConflictState = z.infer<typeof ConflictStateSchema>;

export function initialConflict(): ConflictState {
  return { raid: null, nextRaidAtSec: 0, raids: 0, attributions: 0, damage: {} };
}
