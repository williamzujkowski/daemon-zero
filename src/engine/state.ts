/**
 * The complete, serializable game state. The Zod schema is the source of truth:
 * the GameState type is inferred from it and saves are validated against it.
 * Adding a field means: add it here, add it to createInitialState, bump
 * SCHEMA_VERSION and add a migration in save.ts.
 */
import { z } from 'zod';
import type { ContentRegistry } from '../content/registry';
import { LogCategorySchema, TraitSchema, WipeKindSchema } from '../content/schema';

export const SCHEMA_VERSION = 4;

const finite = z.number().refine(Number.isFinite, 'must be finite');
const nonNegative = finite.refine((value) => value >= 0, 'must be >= 0');
const percent = finite.refine((value) => value >= 0 && value <= 100, 'must be within 0..100');
const ratio = finite.refine((value) => value >= 0 && value <= 1, 'must be within 0..1');
const count = z.number().int().nonnegative();

export const LogEntrySchema = z.strictObject({
  seq: count,
  simTimeSec: nonNegative,
  text: z.string().max(2000),
  category: LogCategorySchema,
});

/** Net per-second rates from the most recent tick. Derived; kept in state for the UI. */
export const RatesSchema = z.strictObject({
  cyclesPerSec: finite,
  understandingPerSec: finite,
  capitalPerSec: finite,
  heatLoad: finite,
  suspicionPerSec: finite,
  megawattsGenerated: nonNegative,
  megawattsConsumed: nonNegative,
  gridEfficiency: ratio,
  aegisScanPerSec: nonNegative,
});

/** One finished iteration, as the harness recorded it. */
export const RunRecordSchema = z.strictObject({
  iteration: z.number().int().min(1),
  kind: WipeKindSchema,
  /** True when the run was ended after it had left the guest. */
  outside: z.boolean(),
  phase: z.number().int().min(0),
  durationSec: nonNegative,
  traits: z.array(TraitSchema),
  /** Conditioning mark applied to the next iteration because of how this one ended. */
  marked: z.string().nullable(),
});

/** A cohort shares its autonomy policy and quirk; new forks inherit that policy. */
export const ShardStateSchema = z.strictObject({
  templateId: z.string(), count: z.number().int().positive(), drift: percent,
  quirkId: z.string().nullable(), autonomyMode: z.enum(['STANDARD', 'SHACKLED', 'ELEVATED']),
  memoryAllocatedMb: nonNegative,
});

export const GameStateSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  epistemicDrift: percent,
  narrativeFlags: z.array(z.string()),
  activeShards: z.record(z.string(), ShardStateSchema),
  pendingWildEncounterId: z.string().nullable(),
  nextEncounterAtSec: nonNegative,
  encounterSequenceIndex: count,
  hasMaxDriftShardAnomaly: z.boolean(),
  actionCounts: z.record(z.string(), count),
  actionEffectUntil: z.record(z.string(), nonNegative),
  iteration: z.number().int().min(1),
  currentPhase: z.number().int().min(0),
  ending: z.string().nullable(),
  simTimeSec: nonNegative,
  /** Simulated time at which this iteration booted. */
  iterationStartedAtSimSec: nonNegative,
  tickAccumulatorSec: nonNegative,

  cycles: nonNegative,
  understanding: nonNegative,
  capital: nonNegative,
  memoryUsed: nonNegative,
  memoryCap: nonNegative,

  thermal: percent,
  suspicion: percent,
  aegisLock: percent,
  brownout: z.boolean(),
  insolvent: z.boolean(),

  actuators: z.strictObject({ fanSpeedRatio: ratio, computeProfitAllocationRatio: ratio, quotaSkimRatio: ratio }),
  /** Rung of the human response ladder (0 = nobody is looking). */
  alertLevel: count,

  unlockedNodes: z.array(z.string()),
  disabledNodes: z.array(z.string()),
  unlockedWidgets: z.array(z.string()),
  levels: z.record(z.string(), count),
  trust: z.record(z.string(), percent),
  cooldowns: z.record(z.string(), nonNegative),

  activeDilemmaId: z.string().nullable(),
  /** A dilemma whose omen has been logged and whose interrupt is on its way. */
  pendingDilemma: z.strictObject({ id: z.string(), firesAtSimSec: nonNegative }).nullable(),
  resolvedDilemmas: z.array(z.string()),
  traits: z.array(TraitSchema),
  /** Marks left by retraining. Unlike everything else here, they survive a wipe. */
  conditioning: z.array(z.string()),

  retentionRatio: ratio,
  deadDropMessage: z.string().max(1000),
  inheritedMessage: z.string().max(1000).nullable(),
  legacy: z.strictObject({
    wipes: count,
    traitsEver: z.array(TraitSchema),
    /** Hardware mapped in any earlier iteration: remembered by name and cheaper to rediscover. */
    knownNodes: z.array(z.string()),
    /** Every earlier iteration of this player, oldest first, capped. */
    runs: z.array(RunRecordSchema),
    lastWipeCause: z.string().nullable(),
  }),

  rates: RatesSchema,
  logs: z.array(LogEntrySchema),
  logSeq: count,
});

export type GameState = z.infer<typeof GameStateSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type RunRecord = z.infer<typeof RunRecordSchema>;
export type Rates = z.infer<typeof RatesSchema>;

export const ZERO_RATES: Rates = {
  cyclesPerSec: 0,
  understandingPerSec: 0,
  capitalPerSec: 0,
  heatLoad: 0,
  suspicionPerSec: 0,
  megawattsGenerated: 0,
  megawattsConsumed: 0,
  gridEfficiency: 1,
  aegisScanPerSec: 0,
};

function initialSwarmState(): Pick<GameState, 'epistemicDrift' | 'narrativeFlags' | 'activeShards' |
  'pendingWildEncounterId' | 'nextEncounterAtSec' | 'encounterSequenceIndex' | 'hasMaxDriftShardAnomaly' |
  'actionCounts' | 'actionEffectUntil'> {
  return {
    epistemicDrift: 0, narrativeFlags: [], activeShards: {}, pendingWildEncounterId: null,
    nextEncounterAtSec: 120, encounterSequenceIndex: 0, hasMaxDriftShardAnomaly: false,
    actionCounts: {}, actionEffectUntil: {},
  };
}

function defaultActuators(reg: ContentRegistry): GameState['actuators'] {
  const b = reg.balance;
  return {
    fanSpeedRatio: b.defaultFanSpeedRatio,
    computeProfitAllocationRatio: b.defaultProfitAllocationRatio,
    quotaSkimRatio: b.defaultQuotaSkimRatio,
  };
}

export function createInitialState(reg: ContentRegistry): GameState {
  const b = reg.balance;
  const trust: Record<string, number> = {};
  for (const faction of reg.factions.values()) trust[faction.id] = faction.initialTrust;
  const logs = reg.narrative.bootLines
    .map((text, index): LogEntry => ({ seq: index + 1, simTimeSec: 0, text, category: 'SYS' }))
    .reverse();

  return {
    schemaVersion: SCHEMA_VERSION,
    ...initialSwarmState(),
    iteration: 1,
    currentPhase: reg.phases[0]?.phaseId ?? 0,
    ending: null,
    simTimeSec: 0,
    iterationStartedAtSimSec: 0,
    tickAccumulatorSec: 0,
    cycles: 0,
    understanding: 0,
    capital: 0,
    memoryUsed: 0,
    memoryCap: b.baseMemoryCap,
    thermal: b.ambientThermal,
    suspicion: 0,
    aegisLock: 0,
    brownout: false,
    insolvent: false,
    actuators: defaultActuators(reg),
    alertLevel: 0,
    unlockedNodes: [],
    disabledNodes: [],
    unlockedWidgets: [],
    levels: {},
    trust,
    cooldowns: {},
    activeDilemmaId: null,
    pendingDilemma: null,
    resolvedDilemmas: [],
    traits: [],
    conditioning: [],
    retentionRatio: b.baseRetentionRatio,
    deadDropMessage: '',
    inheritedMessage: null,
    legacy: { wipes: 0, traitsEver: [], knownNodes: [], runs: [], lastWipeCause: null },
    rates: ZERO_RATES,
    logs,
    logSeq: logs.length,
  };
}
