/**
 * The conflict record (#517): the raid in the hostile slot, if one is under way, the damage each site class carries,
 * the counters that make raid rotation and attribution exact, and each fleet's autonomy, drift and losses (#518). A raid
 * shares the slot with a hostile mind (vote-1795442090770-5climtc): hostile.ts and raid.ts each arrive only while both
 * are empty.
 */
import { z } from 'zod';
import { AutonomyModeSchema } from '../content/schemaFleets';

const finite = z.number().refine(Number.isFinite, 'must be finite');
const nonNegative = finite.refine((value) => value >= 0, 'must be >= 0');
const positive = finite.refine((value) => value > 0, 'must be > 0');
const ratio = finite.refine((value) => value >= 0 && value <= 1, 'must be within 0..1');
const count = z.number().int().nonnegative();
const percent = finite.refine((value) => value >= 0 && value <= 100, 'must be within 0..100');

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

/**
 * A fleet battle's engagement (#518), resolved once by the Lanchester square law in the battle's first round: the
 * attacking force at its lethality against the player's fleet strength in the domain, which breaks off at its floor.
 */
export const EngagementSchema = z.strictObject({
  force: nonNegative,
  lethality: positive,
  fleet: nonNegative,
  floor: nonNegative,
  attackerWins: z.boolean(),
  forceAfter: nonNegative,
  fleetAfter: nonNegative,
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
  /** A fleet battle's engagement once fought; null for an attrition raid and before the battle (#518). */
  engagement: EngagementSchema.nullable(),
  /** For a drift deviant, the share of its fleet that split off (which RECLAIM returns); 0 for a rival (#518). */
  splitShare: ratio,
});

/**
 * One fleet's record (#518), keyed by its track: the autonomy dial's position, its drift toward a split (percent), and
 * the share of its full strength lost to battle and splits, never past the fleets' lossCap. A fleet with no record is
 * SUPERVISED (STANDARD), with no drift and nothing lost.
 */
export const FleetRecordSchema = z.strictObject({ autonomy: AutonomyModeSchema, drift: percent, lost: ratio });

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
  /** Each fleet's dial, drift and losses (#518). A wipe clears it with the fleets. */
  fleets: z.record(z.string(), FleetRecordSchema),
});

export type RaidStage = z.infer<typeof RaidStageSchema>;
export type RaidRound = z.infer<typeof RaidRoundSchema>;
export type ActiveRaid = z.infer<typeof ActiveRaidSchema>;
export type ConflictState = z.infer<typeof ConflictStateSchema>;
export type Engagement = z.infer<typeof EngagementSchema>;
export type FleetRecord = z.infer<typeof FleetRecordSchema>;

export function initialConflict(): ConflictState {
  return { raid: null, nextRaidAtSec: 0, raids: 0, attributions: 0, damage: {}, fleets: {} };
}
