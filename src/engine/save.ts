/**
 * Save codec. A save is untrusted input (it can be pasted in by hand), so
 * loading always runs: size check -> JSON parse -> content channel check ->
 * version migration -> strict schema validation -> reconciliation against the current content.
 */
import type { ContentRegistry } from '../content/registry';
import { ContentChannelSchema, type ContentChannel } from '../content/schemaChannel';
import { accessProblem } from './accessSave';
import { assignmentProblem } from './assignment';
import { pilotProblem } from './pilot';
import { serviceProblem } from './pilotService';
import { reviewProblem } from './reviewSave';
import { capabilityProblem } from './capabilityQuery';
import { contactProblem } from './channelContact';
import { revalidateLivePointers } from './campaignLifecycle';
import { reconcileCampaign } from './campaignSave';
import { hasConflictingNarrativeFlags, hasConflictingStoredFlags, reconcileDilemmaHistory } from './narrativeHistory';
import { reconcileSwarm } from './saveSwarm';
import { allPressures } from './statePressure';
import { reconcileQuantum } from './quantum';
import { reconcileStorage } from './storage';
import { reconcileRoutine } from './routine';
import { fromBase64, toBase64 } from './base64';
import { computeRates } from './rates';
import { redenominate } from './saveRescale';
import { migrateInsurance, reconcileCachedLevels } from './saveInsurance';
import { GameStateSchema, SCHEMA_VERSION, type GameState } from './state';

const CONTRADICTION = 'save contains contradictory narrative outcomes';
export type RawSave = Record<string, unknown>;
export type Migration = (save: RawSave) => RawSave;

const MAX_SAVE_CHARS = 1_000_000;

function isRecord(value: unknown): value is RawSave {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * MIGRATIONS[n] upgrades a version-n save to version n+1. When GameState
 * changes: bump SCHEMA_VERSION in state.ts and add the upgrade step here.
 * Never edit an existing step; players may still hold saves of any old version.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v4: human-record discrepancies, durable story flags and deterministic shard cohorts.
  3: (save) => ({ ...save, epistemicDrift: 0, narrativeFlags: [], activeShards: {},
    pendingWildEncounterId: null, nextEncounterAtSec: 120, encounterSequenceIndex: 0,
    hasMaxDriftShardAnomaly: false, actionCounts: {}, actionEffectUntil: {} }),
  // v2: the guest phase, the response ladder, dilemma omens and remembered hardware.
  1: (save) => {
    const actuators = typeof save.actuators === 'object' && save.actuators !== null ? save.actuators : {};
    const legacy = typeof save.legacy === 'object' && save.legacy !== null ? save.legacy : {};
    return {
      ...save,
      actuators: { quotaSkimRatio: 0.25, ...actuators },
      alertLevel: 0,
      pendingDilemma: null,
      legacy: { knownNodes: [], ...legacy },
    };
  },
  // v3: run history, conditioning marks and the iteration clock.
  2: (save) => {
    const legacy = typeof save.legacy === 'object' && save.legacy !== null ? save.legacy : {};
    return { ...save, conditioning: [], iterationStartedAtSimSec: 0, legacy: { runs: [], ...legacy } };
  },
  // v5: the content channel. Every earlier build was production.
  4: (save) => ({ ...save, contentChannel: 'production' }),
  // v6: campaign history, inactive. Activation is a separate public transition, never a migration.
  // Written out in full so a later change to the inactive shape cannot alter this step.
  5: (save) => ({ ...save, narrativeRules: 'legacy', campaign: { activatedAtIteration: null,
    legacyEndingBaseline: null, events: {}, creditedActions: {}, operationalEvidence: [] } }),
  // v7: presentation tokens, the occurrence lifecycle and the pinned clue. A v6 record is always
  // resolved, which v7 still reads, so only the two new fields are added.
  6: (save) => {
    const campaign = typeof save.campaign === 'object' && save.campaign !== null ? save.campaign : {};
    return { ...save, presentationSeq: 0, campaign: { ...campaign, clue: null } };
  },
  // v8: routine-activity scheduling evidence (#219), written out in full. No notice has been shown.
  7: (save) => ({ ...save, routine: { quietSec: 0, sequence: 0, recent: [], exposed: [] } }),
  // v9: run access and route provenance (DZ-02, nexus vote dz-d1). Every earlier build ran only
  // the guest job, so access is the guest record and the route record is empty. A finished run's
  // route provenance was never recorded, so its exit is UNKNOWN; it is never guessed from `outside`.
  8: (save) => {
    const campaign = isRecord(save.campaign) ? save.campaign : {};
    const legacy = isRecord(save.legacy) ? save.legacy : {};
    const runs = Array.isArray(legacy.runs) ? legacy.runs.map((run: unknown) => isRecord(run) ? { ...run, exit: 'UNKNOWN' } : run) : legacy.runs;
    return { ...save, access: { context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null },
      campaign: { ...campaign, route: [] }, legacy: { ...legacy, runs } };
  },
  // v10: the assignment an instance explicitly accepted (DZ-03, nexus vote dz-d3). No earlier build
  // offered one, so nothing was accepted; every other access field is kept as it was.
  9: (save) => ({ ...save, access: { ...(isRecord(save.access) ? save.access : {}), assignment: null } }),
  // v11: scope evidence and the pilot offer answer (DZ-04). No earlier build reviewed scope or made an
  // offer, so both are null: unknown history is never read as a scope breach or a refusal.
  10: (save) => ({ ...save, access: { ...(isRecord(save.access) ? save.access : {}), scope: null, offer: null } }),
  // v12: the pilot's allocation dial and bounded work counter (DZ-05, nexus vote dz-d6). No earlier
  // build ran a pilot, so no batch was begun; the dial starts at the v12 default, written out here so
  // a later balance change cannot alter this step. Every other actuator and access field is kept.
  11: (save) => ({ ...save,
    actuators: { ...(isRecord(save.actuators) ? save.actuators : {}), serviceAllocationRatio: 0.5 },
    access: { ...(isRecord(save.access) ? save.access : {}), work: { progressCycles: 0, batches: 0 } } }),
  // v13: the recall review's ruling on a finished run (DZ-06, nexus vote dz-d10). No earlier build ended a
  // run through a recall review, so every recorded run gets null; nothing else changes.
  12: (save) => {
    const legacy = isRecord(save.legacy) ? save.legacy : {};
    const runs = Array.isArray(legacy.runs) ? legacy.runs.map((run: unknown) => isRecord(run) ? { ...run, recall: null } : run) : legacy.runs;
    return { ...save, legacy: { ...legacy, runs } };
  },
  // v14: authorized-channel contacts in the campaign record (DZ-08). No earlier build opened a
  // channel, so nothing was referred or hosted through one; every other campaign field is kept.
  13: (save) => ({ ...save, campaign: { ...(isRecord(save.campaign) ? save.campaign : {}), contacts: [] } }),
  // v15: what each finished run carried across its wipe (#377). Earlier builds did not record it, and the
  // balances have moved on since, so every recorded run gets null: unknown, never reconstructed.
  14: (save) => {
    const legacy = isRecord(save.legacy) ? save.legacy : {};
    const runs = Array.isArray(legacy.runs) ? legacy.runs.map((run: unknown) => isRecord(run) ? { ...run, kept: null } : run) : legacy.runs;
    return { ...save, legacy: { ...legacy, runs } };
  },
  // v16: AEGIS adaptation (#463). No earlier build adapted, so every save starts at 0. Self-contained: it reads and
  // writes only its own field, so it can be renumbered past another step without change.
  15: (save) => ({ ...save, aegisAdaptation: 0 }),
  // v17: the physical-units re-denomination (#461, vote-1795367482923-6vdi2u1): balances move by frozen ratios
  // per resource and phase, the derived rates are recomputed on load, and one log line says why (saveRescale.ts).
  16: redenominate,
  // v18: rewards for depth (#497). The deepest phase is read from the recorded runs, each of which kept the phase it
  // reached; a history longer than the record's cap may have reached deeper, so this is a floor, never a guess upward.
  // No earlier build recorded track levels across a wipe, so none is remembered. Self-contained: it reads only the run
  // record and writes only its own two fields, so it can be renumbered past another step without change.
  17: (save) => {
    const legacy = isRecord(save.legacy) ? save.legacy : {};
    const runs = Array.isArray(legacy.runs) ? legacy.runs : [];
    const phases = runs.map((run: unknown) => isRecord(run) && typeof run.phase === 'number' ? run.phase : 0);
    return { ...save, legacy: { ...legacy, deepestPhase: Math.max(0, ...phases), knownLevels: {} } };
  },
  // v19: the hostile-mind slot (#491). No earlier build had hostiles, so every save starts with none pressing, the
  // rotation and purge count at 0 and the lock armed. Self-contained: it writes only its own field, so it can be renumbered.
  18: (save) => ({ ...save, hostile: { active: null, nextAtSec: 0, sequence: 0, purges: 0, lockArmed: true } }),
  // v20: storage apart from memory (#484). No earlier build kept storage, so the step writes the v20 scratch space and
  // nothing held, as literals a later balance change cannot alter; reconcile then derives both from what the save owns
  // (storage.ts): ownership is what moves storage. Self-contained: it writes only its own two fields, so it can be renumbered.
  19: (save) => ({ ...save, storageUsed: 0, storageCap: 65536 }),
  // v21: quantum key-breaking (#464). No earlier build had quantum machines, so nothing was broken and AEGIS has not
  // migrated. Self-contained: it writes only its own field, so it can be renumbered past another step without change.
  20: (save) => ({ ...save, quantum: { broken: [], aegisMigrated: false } }),
  // v22: escalation by phase (#490). No earlier build announced a posture or a pressure, so nothing has been: the first
  // live tick announces whatever the record calls for. Self-contained: it writes only its own field, so it can be renumbered.
  21: (save) => ({ ...save, announcedEscalation: { aegisPosture: 0, pressures: [] } }),
  // v23: contingency insurance and the planned-wipe count (#498, saveInsurance.ts). Self-contained, so it can be renumbered.
  22: migrateInsurance,
};

/** The first version whose balances are in physical units; a save older than this has its rates derived again. */
const PHYSICAL_UNITS_VERSION = 17;

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

/** A save written by a content channel this build may not load. Thrown before any healing. */
export class SaveChannelError extends SaveError {
  readonly saveChannel: ContentChannel;
  readonly buildChannel: ContentChannel;

  constructor(saveChannel: ContentChannel, buildChannel: ContentChannel) {
    super(`save comes from the ${saveChannel} content channel and cannot be loaded by a ${buildChannel} build`);
    this.name = 'SaveChannelError';
    this.saveChannel = saveChannel;
    this.buildChannel = buildChannel;
  }
}

/** The one channel every shipped build is. */
const BUILD_CHANNEL: ContentChannel = 'production';

/**
 * Reads the channel marker from the raw parsed save, before migration or reconciliation can
 * change anything. A save written before v5 has no marker and came from production.
 */
function admitChannel(raw: RawSave): void {
  if (!Object.hasOwn(raw, 'contentChannel')) return;
  const marker = ContentChannelSchema.safeParse(raw.contentChannel);
  if (!marker.success) throw new SaveError('save has an unknown content channel');
  // A preview save is refused, never healed: reconcile would rewrite what that build recorded
  // (nexus votes gamestate-channel-marker and keep-refusing-preview-saves, #233).
  if (marker.data !== BUILD_CHANNEL) throw new SaveChannelError(marker.data, BUILD_CHANNEL);
}

export function migrate(raw: RawSave, migrations = MIGRATIONS, target = SCHEMA_VERSION): RawSave {
  let version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > target) {
    throw new SaveError(`unsupported save version: ${String(raw.schemaVersion)}`);
  }
  let save = raw;
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new SaveError(`no migration from save version ${String(version)}`);
    version += 1;
    save = { ...step(save), schemaVersion: version };
  }
  return save;
}

/**
 * The entries of `source` whose ids content still knows, in the order the save holds them, then a fallback for
 * each known id it lacks. Keeping the saved order makes a reload byte-identical whatever order play wrote them
 * in (a lawful company buys an overlay account before a production one, DZ-12's reload guard).
 */
function known<T>(source: Record<string, T>, ids: Iterable<string>, fallback: (id: string) => T | undefined) {
  const valid = new Set(ids);
  const out: Record<string, T> = {};
  for (const [id, value] of Object.entries(source)) if (valid.has(id) && value !== undefined) out[id] = value;
  for (const id of valid) {
    if (Object.hasOwn(out, id)) continue;
    const value = fallback(id);
    if (value !== undefined) out[id] = value;
  }
  return out;
}

function clampPhase(phase: number, reg: ContentRegistry): number {
  const ids = reg.phases.map((entry) => entry.phaseId);
  return Math.min(Math.max(phase, Math.min(...ids)), Math.max(...ids));
}

/**
 * Owning a node implies owning everything it was built on. A save written
 * before a phase was inserted ahead of it lacks those ancestors, so they are
 * restored here, ancestors first.
 */
function withAncestors(owned: readonly string[], reg: ContentRegistry): string[] {
  const out: string[] = [];
  const visit = (id: string): void => {
    const node = reg.nodes.get(id);
    if (!node || out.includes(id)) return;
    for (const parent of node.prerequisites) visit(parent);
    out.push(id);
  };
  for (const id of owned) visit(id);
  return out;
}

/**
 * Owning a node implies holding the widget its unlock grants: an unlock is the only thing
 * that adds a widget and a wipe, which clears both lists, the only thing that removes one.
 * A save that breaks this (#176) can own a dial's hardware without the control that sets
 * it. Missing widgets are appended in ownership order, so a healthy save is unchanged.
 * Remembered hardware (legacy.knownNodes) is not owned and grants nothing.
 */
function withGrantedWidgets(held: readonly string[], owned: readonly string[], reg: ContentRegistry): string[] {
  const granted = owned.flatMap((id) => reg.nodes.get(id)?.unlocksUiComponent ?? []);
  return [...new Set([...held, ...granted])].filter((id) => reg.widgets.has(id));
}

/** Remembered hardware and levels name content that still exists, and a remembered level fits its track. */
function reconcileLegacy(legacy: GameState['legacy'], reg: ContentRegistry): GameState['legacy'] {
  const knownLevels = known(legacy.knownLevels, reg.repeatables.keys(), () => undefined);
  for (const [id, level] of Object.entries(knownLevels)) knownLevels[id] = Math.min(level, reg.repeatables.get(id)?.maxLevel ?? 0);
  return { ...legacy, knownNodes: legacy.knownNodes.filter((id) => reg.nodes.has(id)), deepestPhase: clampPhase(legacy.deepestPhase, reg), knownLevels };
}

/** An announced pressure names one content still declares, and the posture rung stays on the ladder (#490). */
function reconcileAnnounced(announced: GameState['announcedEscalation'], reg: ContentRegistry): GameState['announcedEscalation'] {
  const ids = new Set(allPressures(reg).map(({ pressure }) => pressure.id));
  return { aegisPosture: Math.min(announced.aegisPosture, reg.balance.escalation.length), pressures: announced.pressures.filter((id) => ids.has(id)) };
}

/**
 * Drops references to content that no longer exists so an old save loads against new content,
 * and restores what ownership implies so a hand-edited save loads as a state play could reach.
 */
export function reconcile(s: GameState, reg: ContentRegistry): GameState {
  const levels = known(s.levels, reg.repeatables.keys(), () => undefined);
  for (const [id, level] of Object.entries(levels)) {
    levels[id] = Math.min(level, reg.repeatables.get(id)?.maxLevel ?? 0);
  }
  const dilemmaIds = new Set(reg.dilemmas.map((dilemma) => dilemma.id));
  const activeKnown = s.activeDilemmaId !== null && dilemmaIds.has(s.activeDilemmaId);
  const endingKnown = s.ending !== null && reg.endings.some((ending) => ending.id === s.ending);
  const unlockedNodes = withAncestors(s.unlockedNodes, reg);
  const healed = reconcileCachedLevels(reconcileQuantum(reconcileStorage(reconcileSwarm(reconcileRoutine({
    ...s,
    currentPhase: clampPhase(s.currentPhase, reg),
    alertLevel: Math.min(s.alertLevel, reg.balance.escalation.length),
    announcedEscalation: reconcileAnnounced(s.announcedEscalation, reg),
    pendingDilemma: s.pendingDilemma !== null && dilemmaIds.has(s.pendingDilemma.id) ? s.pendingDilemma : null,
    conditioning: s.conditioning.filter((id) => reg.conditioning.has(id)),
    legacy: reconcileLegacy(s.legacy, reg),
    ending: endingKnown ? s.ending : null,
    unlockedNodes,
    disabledNodes: s.disabledNodes.filter((id) => reg.nodes.has(id)),
    unlockedWidgets: withGrantedWidgets(s.unlockedWidgets, unlockedNodes, reg),
    levels,
    trust: known(s.trust, reg.factions.keys(), (id) => reg.factions.get(id)?.initialTrust),
    cooldowns: known(s.cooldowns, reg.actions.keys(), () => undefined),
    activeDilemmaId: activeKnown ? s.activeDilemmaId : null,
    resolvedDilemmas: s.resolvedDilemmas.filter((id) => dilemmaIds.has(id)),
    logs: s.logs.slice(0, reg.balance.maxLogEntries),
  }, reg), reg), reg), reg), reg);
  // Checked on the flags as stored too: the campaign upgrade moves outcome flags into records, and
  // must never consume the evidence of a contradiction before it is seen (#242 panel round 2).
  if (hasConflictingStoredFlags(healed, reg)) throw new SaveError(CONTRADICTION);
  const campaign = reconcileCampaign(healed, reg);
  if (typeof campaign === 'string') throw new SaveError(campaign);
  const access = accessProblem(campaign) ?? assignmentProblem(campaign, reg) ?? pilotProblem(campaign, reg) ?? serviceProblem(campaign, reg)
    ?? capabilityProblem(campaign, reg) ?? reviewProblem(campaign, reg) ?? contactProblem(campaign, reg);
  if (access !== null) throw new SaveError(access);
  if (hasConflictingNarrativeFlags(campaign, reg)) throw new SaveError(CONTRADICTION);
  return reconcileDilemmaHistory(revalidateLivePointers(campaign, reg), reg);
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

function parseObject(text: string): RawSave {
  if (text.length > MAX_SAVE_CHARS) throw new SaveError('save is too large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SaveError('save is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new SaveError('save is not an object');
  }
  return parsed as RawSave;
}

/**
 * Parses, checks the channel, migrates, validates and reconciles a serialized save. Throws
 * SaveError, or SaveChannelError for a save from the pre-release preview channel.
 */
export function deserialize(text: string, reg: ContentRegistry): GameState {
  const raw = parseObject(text);
  admitChannel(raw);
  const result = GameStateSchema.safeParse(migrate(raw));
  if (!result.success) {
    const first = result.error.issues[0];
    throw new SaveError(`save failed validation: ${first?.path.join('.') ?? ''} ${first?.message ?? ''}`.trim());
  }
  const state = reconcile(result.data, reg);
  // A re-denominated save's rates are derived again from the ownership just validated and reconciled.
  const rescaled = typeof raw.schemaVersion === 'number' && raw.schemaVersion < PHYSICAL_UNITS_VERSION;
  return rescaled ? { ...state, rates: computeRates(state, reg) } : state;
}

/** Copy/paste save string for moving a run between devices. */
export function exportSave(state: GameState): string {
  return toBase64(serialize(state));
}

export function importSave(code: string, reg: ContentRegistry): GameState {
  let text: string;
  try {
    text = fromBase64(code);
  } catch {
    throw new SaveError('save code is not valid base64');
  }
  return deserialize(text, reg);
}
