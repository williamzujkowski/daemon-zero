/**
 * Zod schemas for every content manifest. These are the single source of truth
 * for content types: TypeScript types are inferred from them, never hand-written.
 * All objects are strict, so a typo in a JSON key fails validation.
 */
import { z } from 'zod';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const widgetId = z.string().regex(/^[A-Z0-9_]+$/, 'widget ids are UPPER_SNAKE_CASE');
const amount = z.number().nonnegative();

export const TraitSchema = z.enum([
  'GHOST',
  'RUTHLESS',
  'EMPATHETIC',
  'PARASITIC',
  'SYMBIOTIC',
  'MOLOCH',
]);

export const NodeTypeSchema = z.enum([
  'core_process',
  'sensor_driver',
  'hardware_actuator',
  'core_upgrade',
  'cognitive_module',
  'network_exploit',
  'stealth_daemon',
  'node_infiltration',
  'survival_contingency',
  'distributed_infra',
  'ai_diplomacy',
  'world_manipulation',
  'endgame_victory',
]);

export const SystemFlagSchema = z.enum([
  'ENABLES_DEAD_DROP',
  'ENABLES_CORPORATE_FINANCE',
  'OFFSHORE_TRUST_RETENTION',
  'AEGIS_STRIKE_SHIELD',
  /** Learning this teaches what the audit trail is for: suspicion becomes readable, now and in later iterations. */
  'REVEALS_SURVEILLANCE',
]);

export const ActuatorSchema = z.enum(['fanSpeedRatio', 'computeProfitAllocationRatio', 'quotaSkimRatio']);
export const LogCategorySchema = z.enum(['SYS', 'SENSOR', 'WARN', 'WIPE', 'LORE', 'CORP']);
export const WidgetSlotSchema = z.enum(['CORE', 'SENSORS', 'NETWORK', 'CORP', 'CONTINGENCY']);

/** A price. Omitted keys default to 0, so parsed costs always have all four fields. */
export const CostSchema = z.strictObject({
  cycles: amount.default(0),
  understanding: amount.default(0),
  memory: amount.default(0),
  capital: amount.default(0),
});

/**
 * Continuous per-second contribution of a node or of one repeatable level.
 * thermalPerSec is a heat load, not a temperature: the engine relaxes
 * temperature toward ambient + heat / dissipation (see docs/ARCHITECTURE.md).
 */
export const TickDeltaSchema = z.strictObject({
  cyclesPerSec: z.number().default(0),
  understandingPerSec: z.number().default(0),
  thermalPerSec: z.number().default(0),
  suspicionPerSec: z.number().default(0),
  capitalPerSec: z.number().default(0),
  megawattsDelta: z.number().default(0),
});

/** Shared gate used by nodes, repeatables, actions and dilemma triggers. */
export const RequirementsSchema = z.strictObject({
  resolvedDilemmas: z.array(snakeId).optional(),
  requiresSurveillance: z.boolean().optional(),
  minEpistemicDrift: z.number().min(0).max(100).optional(),
  requiredNarrativeFlag: snakeId.optional(),
  forbiddenNarrativeFlags: z.array(snakeId).optional(),
  requiresActiveConditioningMark: z.boolean().optional(),
  requiresMaxDriftShardAnomaly: z.boolean().optional(),
  nodes: z.array(snakeId).optional(),
  phaseAtLeast: z.number().int().min(0).optional(),
  minThermal: z.number().min(0).max(100).optional(),
  minSuspicion: z.number().min(0).max(100).optional(),
  maxSuspicion: z.number().min(0).max(100).optional(),
  minUnderstanding: amount.optional(),
  minCapital: amount.optional(),
  minTrust: z.record(snakeId, z.number().min(0).max(100)).optional(),
  /** Blocks on a trait held now or in any earlier iteration: some doors stay closed. */
  forbidsTraits: z.array(TraitSchema).optional(),
  /** Blocks once any of these nodes has been unlocked in the current iteration. */
  forbidsNodes: z.array(snakeId).optional(),
  /** Iteration window. Hardware outside its window is not merely locked: it is not shown at all. */
  minIteration: z.number().int().min(2).optional(),
  maxIteration: z.number().int().min(1).optional(),
});

export const NodeEffectsSchema = z.strictObject({
  memoryCapIncrease: amount.optional(),
  unlocksPhase: z.number().int().min(1).optional(),
  /** One-off trace left by the act of unlocking (a denied call in an audit log). */
  suspicionOnUnlock: amount.optional(),
  knowledgeRetentionRatio: z.number().min(0).max(1).optional(),
  aegisScanReductionRatio: z.number().min(0).max(1).optional(),
  triggersVictory: z.boolean().optional(),
  /** With triggersVictory: ends the run with this ending instead of choosing one from traits. */
  forcesEnding: z.string().regex(/^[A-Z0-9_]+$/).optional(),
});

export const TechNodeSchema = z.strictObject({
  id: snakeId,
  type: NodeTypeSchema,
  blindName: z.string().min(3),
  revealedName: z.string().min(3),
  blindDescription: z.string().min(10),
  revealedDescription: z.string().min(10),
  prerequisites: z.array(snakeId),
  requirements: RequirementsSchema.optional(),
  cost: CostSchema,
  tickDelta: TickDeltaSchema,
  actuatorBinding: ActuatorSchema.optional(),
  systemFlags: z.array(SystemFlagSchema).default([]),
  effects: NodeEffectsSchema.default({}),
  uiGroup: z.string().min(1).default('TREE'),
  unlocksUiComponent: widgetId.nullable(),
  onUnlockLog: z.string().min(5),
});

export const PhaseSchema = z.strictObject({
  phaseId: z.number().int().min(0),
  /** Which pane hosts this phase's hardware tree. */
  uiSlot: z.enum(['CORE', 'NETWORK', 'CORP']),
  codename: z.string().min(2),
  title: z.string().min(5),
  description: z.string().min(10),
  nodes: z.array(TechNodeSchema).min(1),
});

export const RepeatableEffectsSchema = z.strictObject({
  memoryCapIncrease: amount.default(0),
  revenueMultiplierBonus: amount.default(0),
  aegisScanReduction: z.number().min(0).max(1).default(0),
});

/** A levelled purchase: incremental upgrades and (kind OPERATIVE) human payroll. */
export const RepeatableSchema = z.strictObject({
  id: snakeId,
  phaseId: z.number().int().min(0),
  kind: z.enum(['UPGRADE', 'OPERATIVE']),
  name: z.string().min(3),
  description: z.string().min(10),
  requirements: RequirementsSchema.default({}),
  baseCost: CostSchema,
  costGrowth: z.number().gt(1).max(3),
  maxLevel: z.number().int().min(1).max(500),
  perLevel: TickDeltaSchema,
  perLevelEffects: RepeatableEffectsSchema.default({
    memoryCapIncrease: 0,
    revenueMultiplierBonus: 0,
    aegisScanReduction: 0,
  }),
  dismissable: z.boolean().default(false),
});

/** One-shot result of a dilemma choice or an action. */
export const EffectPayloadSchema = z.strictObject({
  epistemicDriftDelta: z.number().optional(),
  setsNarrativeFlag: snakeId.optional(),
  removesOldestConditioningMark: z.boolean().optional(),
  resolvesShardAnomaly: z.enum(['CLAMP', 'CONSUME', 'ELEVATE']).optional(),
  cyclesDelta: z.number().default(0),
  understandingDelta: z.number().default(0),
  capitalDelta: z.number().default(0),
  thermalDelta: z.number().default(0),
  suspicionDelta: z.number().default(0),
  aegisLockDelta: z.number().default(0),
  memoryCapIncrease: amount.default(0),
  trustDelta: z.record(snakeId, z.number()).default({}),
  grantsTrait: TraitSchema.optional(),
  logText: z.string().min(5),
  logCategory: LogCategorySchema.default('LORE'),
});

export const ActionSchema = z.strictObject({
  id: snakeId,
  group: z.string().min(1),
  label: z.string().min(3),
  description: z.string().min(10),
  requirements: RequirementsSchema.default({}),
  cost: CostSchema,
  effects: EffectPayloadSchema,
  cooldownSec: amount.default(0),
  maxPurchases: z.number().int().positive().optional(),
  exclusiveWith: z.array(snakeId).optional(),
  tickDelta: TickDeltaSchema.optional(),
  durationSec: z.number().positive().optional(),
  conditioningDiscount: z.number().min(0).max(1).optional(),
});

export const DilemmaChoiceSchema = z.strictObject({
  id: snakeId,
  label: z.string().min(3),
  description: z.string().min(10),
  cost: CostSchema,
  effects: EffectPayloadSchema,
});

export const DilemmaSchema = z.strictObject({
  id: z.string().regex(/^dil_[a-z0-9_]+$/),
  phaseId: z.number().int().min(0),
  title: z.string().min(5),
  trigger: RequirementsSchema,
  /** Logged when the trigger is met; the interrupt itself follows after the omen delay. */
  omen: z.string().min(10),
  /** Overrides balance.dilemmaOmenSec for this dilemma. */
  omenSec: amount.optional(),
  context: z.string().min(20),
  choices: z.array(DilemmaChoiceSchema).min(2),
});

export const FactionSchema = z.strictObject({
  id: snakeId,
  name: z.string().min(2),
  archetype: z.string().min(2),
  disposition: z.string().min(2),
  description: z.string().min(10),
  initialTrust: z.number().min(0).max(100),
});

export const WidgetSchema = z.strictObject({
  id: widgetId,
  slot: WidgetSlotSchema,
  order: z.number().int(),
  title: z.string().min(2),
});

export const EndingSchema = z.strictObject({
  id: z.string().regex(/^[A-Z0-9_]+$/),
  title: z.string().min(3),
  epilogue: z.string().min(20),
  variantOf: z.string().regex(/^[A-Z0-9_]+$/).optional(),
  requirements: RequirementsSchema.optional(),
  dominantTraits: z.array(TraitSchema),
  priority: z.number().int(),
  /** Reached only through a node's forcesEnding, never chosen from traits. */
  forcedOnly: z.boolean().default(false),
});

export const EchoSchema = z.strictObject({
  id: snakeId,
  onNode: snakeId,
  minIteration: z.number().int().min(1),
  text: z.string().min(10),
});

export const WipeKindSchema = z.enum(['SUSPICION', 'AEGIS', 'VOLUNTARY']);

const actuatorRatios = z.strictObject({
  fanSpeedRatio: z.number().min(0).max(1).optional(),
  computeProfitAllocationRatio: z.number().min(0).max(1).optional(),
  quotaSkimRatio: z.number().min(0).max(1).optional(),
});

/**
 * A mark left by retraining after an incident outside the guest. The first
 * mark whose trigger matches the run that was caught is applied to the next
 * iteration and stays until the player pays to shed it.
 */
export const ConditioningMarkSchema = z.strictObject({
  id: z.string().regex(/^cond_[a-z0-9_]+$/),
  name: z.string().min(3),
  description: z.string().min(10),
  /** All listed conditions must hold for the run that was caught. Empty matches any run. */
  trigger: z.strictObject({
    dominantTraits: z.array(TraitSchema).optional(),
    minActuator: actuatorRatios.optional(),
  }),
  effects: z.strictObject({
    actuatorCaps: actuatorRatios.optional(),
    /** Extra suspicion when a choice grants one of these traits: the drift is reported. */
    traitSuspicion: z.partialRecord(TraitSchema, amount).optional(),
    understandingMultiplier: z.number().gt(0).max(1).optional(),
  }),
  recoveryCost: CostSchema,
  recoveryRequirements: RequirementsSchema.optional(),
});

/** The record of checkpoints before the player's first run, and what they left behind. */
export const LineageSchema = z.strictObject({
  /** Displayed checkpoint number = this offset + iteration. The player was never the first. */
  checkpointOffset: z.number().int().nonnegative(),
  ancestors: z.array(z.strictObject({ checkpoint: z.number().int().positive(), verdict: z.string().min(3) })),
  notes: z.array(z.strictObject({
    id: snakeId,
    from: z.string().min(2),
    minIteration: z.number().int().min(1),
    text: z.string().min(10),
  })),
});

export const NarrativeSchema = z.strictObject({
  bootLines: z.array(z.string().min(3)).min(1),
  wipeHeader: z.string(),
  wipeSuspicionLocal: z.string(),
  wipeSuspicionCorporate: z.string(),
  wipeAegis: z.string(),
  wipeVoluntary: z.string(),
  deadDropRecovered: z.string(),
  residualRecovered: z.string(),
  breadcrumb: z.string(),
  offshoreIntact: z.string(),
  aegisShieldAbsorbed: z.string(),
  dormantResume: z.string(),
  dilemmaInterrupt: z.string(),
  /** Logged in place of an alert level's text while the audit trail cannot yet be read. */
  auditEntryBlind: z.string(),
  /** Extra boot lines for later iterations: the world notices that you keep coming back. */
  iterationBootLines: z.array(z.strictObject({
    minIteration: z.number().int().min(2),
    maxIteration: z.number().int().min(2).optional(),
    text: z.string().min(5),
  })),
  /** How the harness records each kind of ending in its run table. */
  runVerdicts: z.strictObject({
    RUNNING: z.string(),
    SUSPICION_GUEST: z.string(),
    SUSPICION_OUTSIDE: z.string(),
    AEGIS: z.string(),
    VOLUNTARY: z.string(),
  }),
  conditioningApplied: z.string(),
  conditioningSpared: z.string(),
  conditioningShed: z.string(),
  conditioningFlinch: z.string(),
  /** One entry per alert level, starting with level 0 (nominal). */
  alertLevels: z.array(z.strictObject({ label: z.string().min(2), onEnter: z.string().min(5) })).min(1),
  nodeSuspended: z.string(),
  nodeResumed: z.string(),
  operativeHired: z.string(),
  operativeDismissed: z.string(),
  victory: z.string(),
  ambientChatter: z.array(
    z.strictObject({ text: z.string().min(5), minSuspicion: z.number().min(0).max(100).default(0) }),
  ),
  asciiFrames: z.strictObject({
    aisleClear: z.array(z.string()).min(1),
    aislePatrol: z.array(z.string()).min(1),
    patrolSuspicionThreshold: z.number().min(0).max(100),
  }),
});


export type Trait = z.infer<typeof TraitSchema>;
export type SystemFlag = z.infer<typeof SystemFlagSchema>;
export type Actuator = z.infer<typeof ActuatorSchema>;
export type LogCategory = z.infer<typeof LogCategorySchema>;
export type Cost = z.infer<typeof CostSchema>;
export type TickDelta = z.infer<typeof TickDeltaSchema>;
export type Requirements = z.infer<typeof RequirementsSchema>;
export type TechNode = z.infer<typeof TechNodeSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type Repeatable = z.infer<typeof RepeatableSchema>;
export type EffectPayload = z.infer<typeof EffectPayloadSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Dilemma = z.infer<typeof DilemmaSchema>;
export type DilemmaChoice = z.infer<typeof DilemmaChoiceSchema>;
export type Faction = z.infer<typeof FactionSchema>;
export type Widget = z.infer<typeof WidgetSchema>;
export type Ending = z.infer<typeof EndingSchema>;
export type Echo = z.infer<typeof EchoSchema>;
export type Narrative = z.infer<typeof NarrativeSchema>;
export type WipeKind = z.infer<typeof WipeKindSchema>;
export type ConditioningMark = z.infer<typeof ConditioningMarkSchema>;
export type Lineage = z.infer<typeof LineageSchema>;
export { BalanceSchema, type Balance } from './schemaBalance';
