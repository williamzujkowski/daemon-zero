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
  offlineCapSec: z.number().positive(),
  offlineEfficiency: z.number().min(0).max(1),
  offlineStepSec: z.number().positive(),
  liveCatchUpThresholdSec: z.number().positive(),
  deadDropMaxChars: z.number().int().positive(),
  maxLogEntries: z.number().int().positive(),
  defaultFanSpeedRatio: z.number().min(0).max(1),
  defaultProfitAllocationRatio: z.number().min(0).max(1),
  defaultQuotaSkimRatio: z.number().min(0).max(1),
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
  /** Rungs of the human response ladder, in ascending order of suspicion. */
  escalation: z.array(z.strictObject({
    at: z.number().gt(0).lt(100),
    decayMultiplier: z.number().min(0).max(1),
    huntPerSec: amount,
  })),
});

export type Balance = z.infer<typeof BalanceSchema>;
