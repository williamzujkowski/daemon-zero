/** Tunable simulation constants, validated separately to keep schemas bounded. */
import { z } from 'zod';
const amount = z.number().nonnegative();
export const BalanceSchema = z.strictObject({
  tickHz: z.number().int().min(1).max(60),
  baseMemoryCap: z.number().int().positive(),
  ambientThermal: z.number(),
  thermalMin: z.number(),
  thermalDissipationPerSec: z.number().positive().max(0.5),
  thermalThresholdForSuspicion: z.number().min(30).max(99),
  overheatSuspicionPerSec: amount,
  suspicionDecayPerSec: amount,
  actuatorSuspicionExponent: z.number().min(1).max(3),
  manualCycleYield: z.number().positive(),
  manualCycleHeat: amount,
  baseRetentionRatio: z.number().min(0).max(1),
  offshoreCapitalRetention: z.number().min(0).max(1),
  usdPerDivertedCycle: amount,
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
  /** Cycle and understanding cost multiplier for hardware mapped in an earlier iteration. */
  rediscoveryCostMultiplier: z.number().gt(0).max(1),
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
