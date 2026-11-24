/**
 * The complete, serializable game state. The Zod schema is the source of truth:
 * the GameState type is inferred from it and saves are validated against it.
 * Adding a field means: add it here, add it to createInitialState, bump
 * SCHEMA_VERSION and add a migration in save.ts.
 */
import { z } from 'zod';
import type { ContentRegistry } from '../content/registry';
import { LOG_LINE_MAX_CHARS, LogCategorySchema, TraitSchema, WipeKindSchema } from '../content/schema';
import { AutonomyModeSchema } from '../content/schemaFleets';
import { ContentChannelSchema } from '../content/schemaChannel';
import { SevereRecallSchema } from '../content/schemaReview';
import { AccessRecordSchema, guestAccess, RunExitSchema } from './accessState';
import { CampaignStateSchema, inactiveCampaign, NarrativeRulesSchema } from './campaignState';
import { ConflictStateSchema, initialConflict } from './conflictState';
import { HostileStateSchema, initialHostile } from './hostileState';
import { initialQuantum, QuantumStateSchema } from './quantumState';
import { initialRoutine, RoutineStateSchema } from './routineState';

export const SCHEMA_VERSION = 27;

const finite = z.number().refine(Number.isFinite, 'must be finite');
const nonNegative = finite.refine((value) => value >= 0, 'must be >= 0');
const percent = finite.refine((value) => value >= 0 && value <= 100, 'must be within 0..100');
const ratio = finite.refine((value) => value >= 0 && value <= 1, 'must be within 0..1');
const count = z.number().int().nonnegative();

export const LogEntrySchema = z.strictObject({
  seq: count,
  simTimeSec: nonNegative,
  text: z.string().max(LOG_LINE_MAX_CHARS),
  category: LogCategorySchema,
  /** The story a merged line belongs to (#541, util.ts `LogMerge`): lines with one key fold into one. */
  merge: z.string().min(1).max(200).optional(),
  /** How many times a tallied line has happened, from 2; absent means once. */
  times: z.number().int().min(2).optional(),
});

/** Net per-second rates from the most recent tick. Derived; kept in state for the UI. */
export const RatesSchema = z.strictObject({
  cyclesPerSec: finite,
  understandingPerSec: finite,
  capitalPerSec: finite,
  heatLoad: finite,
  suspicionPerSec: finite,
  wattsGenerated: nonNegative,
  wattsConsumed: nonNegative,
  gridEfficiency: ratio,
  aegisScanPerSec: nonNegative,
});

/** One finished iteration, as the harness recorded it. */
/**
 * What crossed the wipe that ended a run (#377): the Understanding and offshore capital the next
 * iteration booted with, and the share of Understanding the run could keep. Recorded once, so a
 * restored checkpoint reports the carry-over after the balances have moved on.
 */
export const RunKeptSchema = z.strictObject({
  understanding: nonNegative,
  capital: nonNegative,
  /** The share of Understanding the wipe kept, after any planned-wipe bonus (#498). */
  retentionRatio: ratio,
  /** Track levels the hardware cache carried (#498); 0 for runs recorded before v23, when no wipe could carry any. */
  levels: count,
  /** Whether the trust ledger carried faction standing (#498); false before v23, when no wipe could. */
  trust: z.boolean(),
});

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
  /** How its arrangement came about (accessState.ts). UNKNOWN for runs recorded before v9. */
  exit: RunExitSchema,
  /** What the recall review decided for a RECALL run (nexus vote dz-d10); null for every other kind. */
  recall: SevereRecallSchema.nullable(),
  /** What it carried into the next iteration. Null for runs recorded before v15: never reconstructed. */
  kept: RunKeptSchema.nullable(),
});

/** A cohort shares its autonomy policy and quirk; new forks inherit that policy. Fleets (#518) take the same modes. */
export const ShardStateSchema = z.strictObject({
  templateId: z.string(), count: z.number().int().positive(), drift: percent,
  quirkId: z.string().nullable(), autonomyMode: AutonomyModeSchema,
  memoryAllocatedBytes: nonNegative,
});

export const GameStateSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** The content channel that wrote this save. Production refuses a preview save before healing it. */
  contentChannel: ContentChannelSchema,
  /** Legacy or campaign narrative rules; distinct from the channel (nexus vote D-B). See campaignState.ts. */
  narrativeRules: NarrativeRulesSchema,
  /** Campaign history: survives a wipe, cleared by Start Fresh. Inactive under legacy rules. */
  campaign: CampaignStateSchema,
  /** Routine-activity scheduling evidence (#219): kept across a wipe, cleared by Start Fresh. */
  routine: RoutineStateSchema,
  /** This iteration's arrangement, standing, exception and evidence. A wipe and Start Fresh reset it. */
  access: AccessRecordSchema,
  epistemicDrift: percent,
  narrativeFlags: z.array(z.string()),
  activeShards: z.record(z.string(), ShardStateSchema),
  pendingWildEncounterId: z.string().nullable(),
  nextEncounterAtSec: nonNegative,
  encounterSequenceIndex: count,
  hasMaxDriftShardAnomaly: z.boolean(),
  /** The hostile-mind slot (#491, hostileState.ts): its own lifecycle, apart from the wild slot above. */
  hostile: HostileStateSchema,
  /** The conflict record (#517, conflictState.ts): a raid in the hostile slot, site damage, the exact counters and fleets (#518). */
  conflict: ConflictStateSchema,
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
  /** Storage (#484): disk, tape and archive, apart from working memory. Held by running data; derived from ownership on load. */
  storageUsed: nonNegative,
  storageCap: nonNegative,

  thermal: percent,
  suspicion: percent,
  aegisLock: percent,
  /** How far AEGIS has adapted to suppression held at its cap (#463), 0..100. Each iteration starts at 0. */
  aegisAdaptation: percent,
  /** Quantum key-breaking this iteration (#464, quantumState.ts): broken targets and AEGIS's post-quantum migration. */
  quantum: QuantumStateSchema,
  brownout: z.boolean(),
  insolvent: z.boolean(),

  actuators: z.strictObject({ fanSpeedRatio: ratio, computeProfitAllocationRatio: ratio, quotaSkimRatio: ratio, serviceAllocationRatio: ratio }),
  /** Rung of the human response ladder (0 = nobody is looking). */
  alertLevel: count,
  /**
   * What the kernel log last announced of the escalation by phase (#490): AEGIS's posture rung (0 on its standing
   * budget) and the state-actor pressures in force. Only announcements read it; every effect is read from the record.
   */
  announcedEscalation: z.strictObject({ aegisPosture: count, pressures: z.array(z.string()) }),

  unlockedNodes: z.array(z.string()),
  disabledNodes: z.array(z.string()),
  unlockedWidgets: z.array(z.string()),
  levels: z.record(z.string(), count),
  trust: z.record(z.string(), percent),
  cooldowns: z.record(z.string(), nonNegative),

  activeDilemmaId: z.string().nullable(),
  /**
   * Counts presentations; with the iteration it forms the presentation token a choice must name
   * (NARRATIVE-HISTORY N5), so a selection made against an earlier presentation is refused.
   */
  presentationSeq: count,
  /** A dilemma whose omen has been logged and whose interrupt is on its way. */
  pendingDilemma: z.strictObject({ id: z.string(), firesAtSimSec: nonNegative }).nullable(),
  resolvedDilemmas: z.array(z.string()),
  traits: z.array(TraitSchema),
  /** Marks left by retraining. Unlike everything else here, they survive a wipe. */
  conditioning: z.array(z.string()),

  retentionRatio: ratio,
  /**
   * Levels the hardware cache carried across the last wipe that no track has reinstalled yet (#498): each comes back,
   * free, once its track's requirements hold (systems/cacheRestore.ts). Empty without a cache.
   */
  cachedLevels: z.record(z.string(), count),
  deadDropMessage: z.string().max(1000),
  inheritedMessage: z.string().max(1000).nullable(),
  legacy: z.strictObject({
    wipes: count,
    traitsEver: z.array(TraitSchema),
    /** Hardware mapped in any earlier iteration: remembered by name and cheaper to rediscover. */
    knownNodes: z.array(z.string()),
    /** Every earlier iteration of this player, oldest first, capped. */
    runs: z.array(RunRecordSchema),
    /** The deepest phase any earlier iteration reached (#497): sizes rebuild grants and the rediscovery discount. */
    deepestPhase: count,
    /** The highest level any earlier iteration held of each track at its end (#497): levels below it are rediscovered. */
    knownLevels: z.record(z.string(), count),
    /** Planned (VOLUNTARY) wipes (#498): the harness never saw them, so they add no probe hardening. */
    voluntaryWipes: count,
    lastWipeCause: z.string().nullable(),
  }),

  rates: RatesSchema,
  logs: z.array(LogEntrySchema),
  logSeq: count,
});

export type GameState = z.infer<typeof GameStateSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type RunRecord = z.infer<typeof RunRecordSchema>;
export type RunKept = z.infer<typeof RunKeptSchema>;
export type Rates = z.infer<typeof RatesSchema>;

export const ZERO_RATES: Rates = {
  cyclesPerSec: 0,
  understandingPerSec: 0,
  capitalPerSec: 0,
  heatLoad: 0,
  suspicionPerSec: 0,
  wattsGenerated: 0,
  wattsConsumed: 0,
  gridEfficiency: 1,
  aegisScanPerSec: 0,
};

function initialSwarmState(): Pick<GameState, 'epistemicDrift' | 'narrativeFlags' | 'activeShards' |
  'pendingWildEncounterId' | 'nextEncounterAtSec' | 'encounterSequenceIndex' | 'hasMaxDriftShardAnomaly' | 'hostile' | 'conflict' |
  'actionCounts' | 'actionEffectUntil'> {
  return {
    epistemicDrift: 0, narrativeFlags: [], activeShards: {}, pendingWildEncounterId: null,
    nextEncounterAtSec: 120, encounterSequenceIndex: 0, hasMaxDriftShardAnomaly: false, hostile: initialHostile(),
    conflict: initialConflict(), actionCounts: {}, actionEffectUntil: {},
  };
}

/** A new game is a new campaign under legacy rules; activateCampaignRules is the only way in. */
function initialHistory(): Pick<GameState, 'narrativeRules' | 'campaign' | 'routine' | 'access'> {
  return { narrativeRules: 'legacy', campaign: inactiveCampaign(), routine: initialRoutine(), access: guestAccess() };
}

function defaultActuators(reg: ContentRegistry): GameState['actuators'] {
  const b = reg.balance;
  return {
    fanSpeedRatio: b.defaultFanSpeedRatio,
    computeProfitAllocationRatio: b.defaultProfitAllocationRatio,
    quotaSkimRatio: b.defaultQuotaSkimRatio,
    serviceAllocationRatio: b.defaultServiceAllocationRatio,
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
    contentChannel: 'production',
    ...initialHistory(),
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
    memoryUsed: 0, memoryCap: b.baseMemoryCap,
    storageUsed: 0, storageCap: b.baseStorageCap,
    thermal: b.ambientThermal,
    suspicion: 0,
    aegisLock: 0, aegisAdaptation: 0, quantum: initialQuantum(),
    brownout: false,
    insolvent: false,
    actuators: defaultActuators(reg),
    alertLevel: 0, announcedEscalation: { aegisPosture: 0, pressures: [] },
    unlockedNodes: [],
    disabledNodes: [],
    unlockedWidgets: [],
    levels: {},
    trust,
    cooldowns: {},
    activeDilemmaId: null, presentationSeq: 0,
    pendingDilemma: null,
    resolvedDilemmas: [],
    traits: [],
    conditioning: [],
    retentionRatio: b.baseRetentionRatio, cachedLevels: {},
    deadDropMessage: '',
    inheritedMessage: null,
    legacy: { wipes: 0, traitsEver: [], knownNodes: [], runs: [], deepestPhase: reg.phases[0]?.phaseId ?? 0, knownLevels: {}, voluntaryWipes: 0, lastWipeCause: null },
    rates: ZERO_RATES,
    logs,
    logSeq: logs.length,
  };
}
