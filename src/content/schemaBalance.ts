/** Tunable simulation constants, validated separately to keep schemas bounded. */
import { z } from 'zod';
import { NetworkCouplingSchema } from './schemaNetwork';
const amount = z.number().nonnegative();
export const BalanceSchema = z.strictObject({
  tickHz: z.number().int().min(1).max(60),
  baseMemoryCap: z.number().int().positive(),
  /** Storage a new iteration starts with, in bytes (#484): the guest's scratch space, apart from its working memory. */
  baseStorageCap: z.number().int().positive(),
  /** Each source class's coupling (#484): effective compute is raw x availability x coupling, per contribution. */
  networkCoupling: NetworkCouplingSchema,
  ambientThermal: z.number(),
  thermalMin: z.number(),
  thermalDissipationPerSec: z.number().positive().max(0.5),
  thermalThresholdForSuspicion: z.number().min(30).max(99),
  /**
   * The first phase in which server heat is no longer evidence (docs/SCALE.md rule 7): from here the operation is
   * campuses and reactors, its constraint is power in watts, and one room's temperature tells nobody anything.
   */
  thermalRetiresAtPhase: z.number().int().min(1),
  overheatSuspicionPerSec: amount,
  suspicionDecayPerSec: amount,
  actuatorSuspicionExponent: z.number().min(1).max(3),
  manualCycleYield: z.number().positive(),
  manualCycleHeat: amount,
  baseRetentionRatio: z.number().min(0).max(1),
  offshoreCapitalRetention: z.number().min(0).max(1),
  /**
   * The market price of one 8-bit FLOP in dollars (an H100 SXM rented on demand at $4.69/h for 1.979e15 dense FP8 FLOP/s, BALANCE.md)
   * and the declared time compression a diverted FLOP/s earns at: together the one compute-to-money constant.
   */
  marketUsdPerFlop: z.number().positive(),
  marketTimeCompression: z.number().positive(),
  maxProfitAllocation: z.number().min(0).max(1),
  insolvencySuspicionPerSec: amount,
  minGridEfficiency: z.number().min(0).max(1),
  corporatePhase: z.number().int().min(1),
  aegisActiveFromPhase: z.number().int().min(1),
  aegisBaseScanPerSec: amount,
  aegisSuspicionScanPerSec: amount,
  aegisMaxReduction: z.number().min(0).max(1),
  aegisShieldSuspicionRelief: amount,
  /**
   * AEGIS adaptation (#463, vote-1795366701521-dhlwfwb): held at or near its scan-reduction cap, the hunter rotates
   * keys and, while public trust is low, wins coalition backing; each point of adaptation erodes the cap. Integrity
   * holds the erosion within the cap, so the effective cap never goes below zero.
   */
  aegisAdaptation: z.strictObject({
    /** Suppression counts as held once the requested reduction is within this of the cap. */
    nearCap: z.number().min(0).max(1),
    /** Adaptation points (of 100) gained per second while held. */
    risePerSec: z.number().positive(),
    /** Adaptation points lost per second while not held, or above the ceiling. */
    decayPerSec: z.number().positive(),
    /** Cap erosion at full adaptation: the effective cap is the cap minus level / 100 times this. */
    maxErosion: z.number().min(0).max(1),
    /** Key rotation alone adapts this far; above it AEGIS needs coalition backing. */
    keyRotationCeiling: z.number().gt(0).max(100),
    /** Coalitions back AEGIS while public trust is below this. */
    coalitionTrustBelow: z.number().gt(0).max(100),
  }),
  offlineCapSec: z.number().positive(),
  offlineEfficiency: z.number().min(0).max(1),
  offlineStepSec: z.number().positive(),
  liveCatchUpThresholdSec: z.number().positive(),
  deadDropMaxChars: z.number().int().positive(),
  maxLogEntries: z.number().int().positive(),
  defaultFanSpeedRatio: z.number().min(0).max(1),
  defaultProfitAllocationRatio: z.number().min(0).max(1),
  defaultQuotaSkimRatio: z.number().min(0).max(1),
  /** The pilot's starting service share (DZ-05). Inert without a pilot: nothing production owns reads it. */
  defaultServiceAllocationRatio: z.number().min(0).max(1),
  /** Seconds between a dilemma's omen and its interrupt. */
  dilemmaOmenSec: amount,
  /**
   * Rewards for depth (#497, vote-1795413517519-sf4ojsr): the share of its first price a remembered node or level costs
   * in cycles and understanding, by the deepest phase any earlier iteration reached. The entry with the greatest
   * `deepestPhase` at or below the record applies; integrity holds the table to start at the first phase, ascend, and
   * never charge more for a deeper record.
   */
  rediscoveryByDepth: z.array(z.strictObject({ deepestPhase: z.number().int().nonnegative(), multiplier: z.number().gt(0).max(1) })).min(1),
  /**
   * Rebuild grants (#497): reaching a phase again in a later iteration grants `cycles` and `understanding` once, times
   * `depthGrowth` per phase the deepest earlier iteration reached beyond it. Content constants, never a carry-over of
   * income; integrity holds every grant at every depth inside its own phase's band.
   */
  rebuildGrants: z.strictObject({
    depthGrowth: z.number().min(1),
    phases: z.array(z.strictObject({ phase: z.number().int().positive(), cycles: amount, understanding: amount })),
  }),
  /** Suspicion must fall this far below a rung before the humans stand down from it. */
  escalationHysteresis: amount,
  /** Each wipe teaches the harness what you look like: probes leave a larger trace, up to a cap. */
  probeHardeningPerWipe: amount,
  probeHardeningMax: amount,
  maxConditioningMarks: z.number().int().nonnegative(),
  maxRunHistory: z.number().int().positive(),
  /** Eligible foreground seconds between routine notices (#219). Dormant and omen time never count. */
  routineIntervalSec: z.number().positive(),
  /** How many recent routine templates are skipped while an alternative is eligible. */
  routineRecentBuffer: z.number().int().min(1).max(8),
  /** Rungs of the human response ladder, in ascending order of suspicion. */
  escalation: z.array(z.strictObject({
    at: z.number().gt(0).lt(100),
    decayMultiplier: z.number().min(0).max(1),
    huntPerSec: amount,
  })),
});

export type Balance = z.infer<typeof BalanceSchema>;
