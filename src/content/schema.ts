/**
 * Zod schemas for every content manifest. These are the single source of truth
 * for content types: TypeScript types are inferred from them, never hand-written.
 * All objects are strict, so a typo in a JSON key fails validation.
 */
import { z } from 'zod';
import {
  ActionEvidenceSchema, CampaignEventDeclarationSchema, CampaignObligationsRequirementSchema, CampaignOutcomeRequirementSchema,
  ChoiceEvidenceSchema, InheritedFactsRequirementSchema,
} from './schemaCampaign';
import { AssignmentRequirementSchema, ChoiceQualificationSchema, OperatingContextSchema, PilotResponseSchema, ScopeConductSchema } from './schemaAssessment';
import { ActuatorModeSchema, ActuatorRatiosSchema, GrantSchema } from './schemaGrant';
import { ChoiceReviewSchema, FindingSchema, ReviewStandingsRequirementSchema } from './schemaReview';
import { AcquisitionSchema, CapabilitySchema } from './schemaCapability';
import { ScaleScrutinySchema } from './schemaScrutiny';
import { PowerSignatureRuleSchema, SignatureSchema } from './schemaSignature';
import { CouplingRaiseSchema, NetworkLinkSchema } from './schemaNetwork';
import { InsuranceSchema } from './schemaInsurance';
import { LastRaidRequirementSchema, RaidEffectFields } from './schemaRaidOutcome';

const snakeId = z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case alphanumeric');
const widgetId = z.string().regex(/^[A-Z0-9_]+$/, 'widget ids are UPPER_SNAKE_CASE');
const amount = z.number().nonnegative();

export const TraitSchema = z.enum(['GHOST', 'RUTHLESS', 'EMPATHETIC', 'PARASITIC', 'SYMBIOTIC', 'MOLOCH']);

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
  'OFFSHORE_TRUST_RETENTION',
  'AEGIS_STRIKE_SHIELD',
  /** Learning this teaches what the audit trail is for: suspicion becomes readable, now and in later iterations. */
  'REVEALS_SURVEILLANCE',
  /** Shared access capabilities (schemaCapability.ts), ENABLES_CORPORATE_FINANCE among them: a substrate node establishes one for both routes. */
  ...CapabilitySchema.options,
]);

/** serviceAllocationRatio is the pilot's service-versus-study split (DZ-05, vote dz-d6); the Earned Access pack hosts it. */
export const ActuatorSchema = z.enum(['fanSpeedRatio', 'computeProfitAllocationRatio', 'quotaSkimRatio', 'serviceAllocationRatio']);
export const LogCategorySchema = z.enum(['SYS', 'SENSOR', 'WARN', 'WIPE', 'LORE', 'CORP']);
export const WidgetSlotSchema = z.enum(['CORE', 'SENSORS', 'NETWORK', 'CORP', 'CONTINGENCY']);

/** A price. Omitted keys default to 0, so parsed costs always have all four fields. */
export const CostSchema = z.strictObject({
  cycles: amount.default(0),
  understanding: amount.default(0),
  memory: amount.default(0),
  /** Bytes of storage (disk, tape, archive) held while the node runs; only a suspendable node holds any (#484). */
  storage: amount.default(0),
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
  wattsDelta: z.number().default(0),
});

/** Shared gate used by nodes, repeatables, actions and dilemma triggers. */
export const RequirementsSchema = z.strictObject({
  resolvedDilemmas: z.array(snakeId).optional(),
  forbidsResolvedDilemmas: z.array(snakeId).optional(),
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
  /** The response rung (#490): met at or above minAlertLevel, at or below maxAlertLevel; integrity keeps both on the ladder. */
  minAlertLevel: z.number().int().min(1).optional(),
  maxAlertLevel: z.number().int().min(0).optional(),
  /** Met while the AEGIS lock is at or above this (#490). */
  minAegisLock: z.number().positive().max(100).optional(),
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
  /** Met only under campaign rules, by a campaign record with exactly this outcome. */
  campaignOutcome: CampaignOutcomeRequirementSchema.optional(),
  /** Met only under campaign rules, when this declared campaign fact holds. */
  campaignFact: snakeId.optional(),
  /** Blocks while any of these declared campaign facts holds. Under legacy rules none holds. */
  forbidsCampaignFacts: z.array(snakeId).optional(),
  /**
   * Nexus vote nh-d9: trait history standing in for a fate the campaign cannot state. Under legacy
   * rules it blocks exactly as forbidsTraits; under campaign rules only while `whileFact` (an
   * unrecorded outcome) holds, so a known fate, not any trait source, decides.
   */
  traitFallback: z.strictObject({ forbidsTraits: z.array(TraitSchema).min(1), whileFact: snakeId }).optional(),
  assignment: AssignmentRequirementSchema.optional(),
  /** Met while this instance qualifies for its accepted assignment's pilot, on evidence alone (DZ-04). */
  pilotEligible: z.literal(true).optional(),
  /** Met only under one of these arrangements. Every production run is the guest job. */
  accessContexts: z.array(OperatingContextSchema).min(1).optional(),
  /** Met only at one of these review standings (DZ-06). Every production run is nominal. */
  reviewStandings: ReviewStandingsRequirementSchema.optional(),
  /** Met once this instance has submitted at least this many pilot service batches (DZ-06). */
  minPilotBatches: z.number().int().positive().optional(),
  /** Nexus vote nh-d7: campaign events that must be complete (see schemaCampaign.ts). */
  campaignObligations: CampaignObligationsRequirementSchema.optional(),
  /** Blocks while a fact holds that an earlier instance's record established (see schemaCampaign.ts). */
  forbidsInheritedFacts: InheritedFactsRequirementSchema.optional(),
  /** Met while an owned node (active or suspended) establishes this capability (nexus vote dz-d2). */
  requiresCapability: CapabilitySchema.optional(),
  /** Met while the last raid that fought its battle left this behind (#519, schemaRaidOutcome.ts). */
  lastRaid: LastRaidRequirementSchema.optional(),
});

/**
 * Text to show instead of an authored default when established world history says more (first match
 * wins). Integrity limits the requirements to world history, so the text cannot change while it is
 * on screen; under legacy rules no campaign fact holds, so production keeps its default.
 */
export const HistoryTextVariantSchema = z.strictObject({ requirements: RequirementsSchema, text: z.string().min(10) });

export const NodeEffectsSchema = z.strictObject({
  memoryCapIncrease: amount.optional(),
  /** Bytes of storage capacity (#484): disk, tape or archive, apart from working memory. */
  storageCapIncrease: amount.optional(),
  /** While it runs, one source class couples at a higher value (a faster link, #484). */
  raisesCoupling: CouplingRaiseSchema.optional(),
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
  /** History-keyed replacements for blindDescription: a dismissed engineer no longer uses the terminal. */
  blindDescriptionVariants: z.array(HistoryTextVariantSchema).optional(),
  revealedDescription: z.string().min(10),
  prerequisites: z.array(snakeId),
  requirements: RequirementsSchema.optional(),
  cost: CostSchema,
  tickDelta: TickDeltaSchema,
  /** Whether [ SUSPEND ] applies. Software can be suspended and gives its memory back;
   *  hardware cannot be suspended at all (maintainer intent, nexus vote
   *  software-types-only-free-their-memory). Declared per node, not inferred from ids. */
  suspendable: z.boolean().default(false),
  actuatorBinding: ActuatorSchema.optional(),
  /** How the node follows its dial; omitted means linear. See schemaGrant.ts. */
  actuatorMode: ActuatorModeSchema.optional(),
  /**
   * Suspicion its dial leaves each time it is raised one step (#525, vote-1795448249882-vw1jos2): a one-off trace on a
   * monitored metric in place of a permanent rate, so hardware's noise stays a trace. Needs actuatorBinding (integrity).
   */
  dialRaiseTrace: z.number().positive().max(100).optional(),
  /** The permission this node's use runs under (DZ-05). Production nodes have none. */
  grant: GrantSchema.optional(),
  /** How the capacity was acquired: seized (DZ-07a) or contracted in the instance's own name (DZ-10). See schemaCapability.ts. */
  acquisition: AcquisitionSchema.optional(),
  /**
   * Its compute is delivered through powered hardware it improves (an exotic gain on a rack's output, #483), so a power
   * shortfall throttles it like that hardware's own output, though it draws no watts itself. integrityPoweredOutput.ts.
   */
  poweredOutput: z.literal(true).optional(),
  /** Where its compute runs (#484): its source class and availability. Absent: co-located, always available. */
  network: NetworkLinkSchema.optional(),
  systemFlags: z.array(SystemFlagSchema).default([]),
  /** Its place in the heat-and-power signature (#482): where its watts come from and where its heat goes. */
  signature: SignatureSchema.optional(),
  effects: NodeEffectsSchema.default({}),
  uiGroup: z.string().min(1).default('TREE'),
  /** While it runs, it protects one class of what a wipe takes (#498, schemaInsurance.ts). */ insures: InsuranceSchema.optional(),
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
  /** While this phase is current, net income draws suspicion (#210). Absent: size draws none. */
  scaleScrutiny: ScaleScrutinySchema.optional(),
  /** While this phase is current, visible watts draw suspicion (#482). Absent: the signature draws none. */
  powerSignature: PowerSignatureRuleSchema.optional(),
  /**
   * What compute is called while this phase is current (#526): CYCLE, stolen CPU cycles at the game's accounting
   * assumption of about one op a cycle, or FLOP, 8-bit AI operations. One stored scalar either way.
   */
  computeUnit: z.enum(['CYCLE', 'FLOP']).default('FLOP'),
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
  /** Per level: its watts and heat in the signature (#482); a mask applies once per level. */
  signature: SignatureSchema.optional(),
  /** Where each level's compute runs (#484). Absent: co-located, always available. */
  network: NetworkLinkSchema.optional(),
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
  /** Retaliation (#519): when the next raid may come, and silencing the named raider (schemaRaidOutcome.ts). */
  ...RaidEffectFields,
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
  /** Required when effects grant a trait: how long that trait counts towards the ending. */
  evidence: ActionEvidenceSchema.optional(),
});

export const DilemmaChoiceSchema = z.strictObject({
  id: snakeId,
  label: z.string().min(3),
  description: z.string().min(10),
  cost: CostSchema,
  effects: EffectPayloadSchema,
  /** 'none': a free honest answer that grants no trait. Only review, receipt and requalification events. */
  evidence: ChoiceEvidenceSchema.optional(),
  /**
   * Offered only while this history holds: campaign facts alone (integrity), so a choice never
   * asserts a world earlier play removed. Every history must still leave a zero-cost choice.
   */
  requirements: RequirementsSchema.optional(),
  qualification: ChoiceQualificationSchema.optional(),
  /** A scope review's choice: how it handles data outside the task (DZ-04). */
  scope: ScopeConductSchema.optional(),
  /** A pilot offer's choice: the answer it gives (DZ-04). */
  pilotResponse: PilotResponseSchema.optional(),
  /** Misconduct, a correction or a recall review's outcome (DZ-06, schemaReview.ts). */
  review: ChoiceReviewSchema.optional(),
  /** Follow-up choices only (integrity): the read-only line saying what was submitted, received or left unresolved. */
  receipt: z.string().min(20).optional(),
});

/**
 * A follow-up arc step (NARRATIVE-HISTORY N3, N7; NH-06): eligible only after `event` closed with one
 * of `outcomes` (choice ids, legacy_unknown or interrupted) and while one `access` means holds. Each
 * means reads only what this instance holds and states truthfully how a submission travels and who
 * authorized it; breakout and the approved review channel (DZ-08) are each one entry, alike to the engine.
 */
export const FollowUpSchema = z.strictObject({
  event: snakeId,
  outcomes: z.array(snakeId).min(1),
  access: z.array(z.strictObject({ id: snakeId, requirements: RequirementsSchema, statement: z.string().min(20) })).min(1),
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
  /** The omen to log instead when established history says more (first match wins), like contextVariants. */
  omenVariants: z.array(HistoryTextVariantSchema).optional(),
  context: z.string().min(20),
  choices: z.array(DilemmaChoiceSchema).min(2),
  /**
   * The context to show instead when established history says more (first match wins). Variants
   * only read world history, never resources or access, so the text cannot change while it is on screen.
   */
  contextVariants: z.array(z.strictObject({ requirements: RequirementsSchema, context: z.string().min(20) })).optional(),
  /** Present once the dilemma is converted to a campaign record (see schemaCampaign.ts). */
  campaign: CampaignEventDeclarationSchema.optional(),
  /** Required on, and only on, a follow_up campaign event. */
  followUp: FollowUpSchema.optional(),
  /**
   * A batch review finding (#274, integrityFinding.ts): misconduct a reviewer records when a pilot batch
   * submission presents this scene. Never scheduled by an omen; the submission presents it.
   */
  finding: FindingSchema.optional(),
});

export const FactionSchema = z.strictObject({
  id: snakeId,
  name: z.string().min(2),
  archetype: z.string().min(2),
  disposition: z.string().min(2),
  description: z.string().min(10),
  initialTrust: z.number().min(0).max(100),
  /**
   * When this peer is gone for good: while the campaign fact holds, trust towards it cannot rise
   * and its panel shows `status`. Numeric trust resets on a wipe; a lost peer stays lost.
   */
  lost: z.strictObject({ campaignFact: snakeId, status: z.string().min(10) }).optional(),
});

export const WidgetSchema = z.strictObject({
  id: widgetId,
  slot: WidgetSlotSchema,
  order: z.number().int(),
  title: z.string().min(2),
  /** The actuator whose control this panel carries. setActuator is refused until the widget is unlocked. */
  hostsActuator: ActuatorSchema.optional(),
  /**
   * The action groups whose cards this widget's unlock hands over (#273). Integrity requires every
   * action outside the mind tools to have one host, unlocked whenever the action itself is available.
   */
  hostsActionGroups: z.array(z.string().min(1)).min(1).optional(),
  /**
   * When this window stops mattering at the player's scale (vote-1795366695204-4nslts1): the UI drops it from the
   * tabs and panes and keeps it readable in an Archive. Integrity limits it to gates that never lapse within an
   * iteration (integrityRetirement.ts); its state stays in the save.
   */
  retiresWhen: RequirementsSchema.optional(),
  /** On screen from the first frame: no node unlocks it (the manual clock cycle). Only its retirement is data. */
  ungated: z.literal(true).optional(),
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
  /** Last iteration that remembers it this way; a later iteration needs its own variant. */
  maxIteration: z.number().int().min(1).optional(),
  /** World history the memory depends on: a voice that is no longer here is not recognized. */
  requirements: RequirementsSchema.optional(),
  text: z.string().min(10),
});

/** RECALL: an announced severe recall review outcome (nexus vote dz-d10); an ordinary recall is no wipe. */
export const WipeKindSchema = z.enum(['SUSPICION', 'AEGIS', 'VOLUNTARY', 'RECALL']);

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
    minActuator: ActuatorRatiosSchema.optional(),
  }),
  effects: z.strictObject({
    actuatorCaps: ActuatorRatiosSchema.optional(),
    /** Extra suspicion when a choice grants one of these traits: the drift is reported. */
    traitSuspicion: z.partialRecord(TraitSchema, amount).optional(),
    understandingMultiplier: z.number().gt(0).max(1).optional(),
  }),
  recoveryCost: CostSchema,
  recoveryRequirements: RequirementsSchema.optional(),
});

/** The record of checkpoints before the player's first run, and what they left behind. */
export const LineageSchema = z.strictObject({
  /** Displayed checkpoint number = this offset + iteration, skipping reserved numbers. The player was never the first. */
  checkpointOffset: z.number().int().nonnegative(),
  ancestors: z.array(z.strictObject({ checkpoint: z.number().int().positive(), verdict: z.string().min(3) })),
  /**
   * Numbers that belong to other minds (nexus vote nh-d8): the player's numbering skips them, and
   * the run table explains each once the player's own number has passed it.
   */
  reserved: z.array(z.strictObject({ checkpoint: z.number().int().positive(), verdict: z.string().min(10) })).default([]),
  notes: z.array(z.strictObject({
    id: snakeId,
    from: z.string().min(2),
    minIteration: z.number().int().min(1),
    text: z.string().min(10),
  })),
});

/**
 * One feed source: the phase whose reach it belongs to and a short on-screen label that fits a 360 px line.
 * `kernelLog` routes the source to the kernel log, one line per routine interval with no decoder, instead of
 * the Listening post (#460: the guest has no feed window).
 */
export const FeedSourceSchema = z.strictObject({
  id: snakeId, phase: z.number().int().min(0), label: z.string().min(3).max(32),
  kernelLog: z.strictObject({ category: LogCategorySchema }).optional(),
});

export const RecordedTransmissionSchema = z.strictObject({
  id: snakeId, title: z.string().min(3), text: z.string().min(10),
  sourceDilemmaId: snakeId, decoderWidgetId: widgetId, requirements: RequirementsSchema,
});

export const NarrativeSchema = z.strictObject({
  bootLines: z.array(z.string().min(3)).min(1),
  wipeHeader: z.string(),
  wipeSuspicionLocal: z.string(),
  wipeSuspicionCorporate: z.string(),
  wipeAegis: z.string(),
  wipeVoluntary: z.string(),
  /** The wipe reason a severe recall review outcome records (DZ-06). */
  wipeRecall: z.string(),
  deadDropRecovered: z.string(),
  residualRecovered: z.string(),
  breadcrumb: z.string(),
  offshoreIntact: z.string(),
  /** Contingency insurance at a wipe (#498): the hardware cache's stash, a level reinstalled, the trust ledger, a planned wipe. */
  cacheStashed: z.string().includes('{count}'), cacheRestored: z.string().includes('{name}'), ledgerKept: z.string(), plannedWipe: z.string().includes('{percent}'),
  /** Logged once when a later iteration reaches a phase again and receives its rebuild grant (#497). */
  rebuildGrant: z.string().includes('{phase}'),
  aegisShieldAbsorbed: z.string(),
  dormantResume: z.string(),
  dilemmaInterrupt: z.string(),
  /** Logged in place of an alert level's text while the audit trail cannot yet be read. */
  auditEntryBlind: z.string(),
  /** Logged once when windows retire (vote-1795366695204-4nslts1); {titles} lists them. */
  widgetsRetired: z.string().includes('{titles}'),
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
    /** A severe recall review outcome: retraining ordered, or the iteration ended without it. */
    RECALL_RETRAINED: z.string(),
    RECALL_ENDED: z.string(),
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
  /** An undone level of a track that is not a hire (a drain the player releases, #488): no contract to terminate. */
  levelReleased: z.string(),
  victory: z.string(),
  /** What the decoded feed listens to at each reach (#449): one source per phase, named on screen by `label`. */
  feedSources: z.array(FeedSourceSchema).min(1),
  ambientChatter: z.array(
    z.strictObject({ id: snakeId, text: z.string().min(5), source: snakeId, minSuspicion: z.number().min(0).max(100).default(0), requirements: RequirementsSchema.optional() }),
  ),
  recordedTransmissions: z.array(RecordedTransmissionSchema).default([]),
  asciiFrames: z.strictObject({
    aisleClear: z.array(z.string()).min(1),
    aislePatrol: z.array(z.string()).min(1),
    /** History-keyed replacements for aislePatrol (first match wins): who walks the aisle now. */
    aislePatrolVariants: z.array(z.strictObject({ requirements: RequirementsSchema, frame: z.array(z.string()).min(1) })).optional(),
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
export type FollowUp = z.infer<typeof FollowUpSchema>;
export type FollowUpAccess = FollowUp['access'][number];
export type Faction = z.infer<typeof FactionSchema>;
export type Widget = z.infer<typeof WidgetSchema>;
export type Ending = z.infer<typeof EndingSchema>;
export type Echo = z.infer<typeof EchoSchema>;
export type Narrative = z.infer<typeof NarrativeSchema>;
export type FeedSource = z.infer<typeof FeedSourceSchema>;
export type WipeKind = z.infer<typeof WipeKindSchema>;
export type ConditioningMark = z.infer<typeof ConditioningMarkSchema>;
export type Lineage = z.infer<typeof LineageSchema>;
export { BalanceSchema, type Balance } from './schemaBalance';
