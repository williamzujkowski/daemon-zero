/**
 * Save codec. A save is untrusted input (it can be pasted in by hand), so
 * loading always runs: size check -> JSON parse -> content channel check ->
 * version migration -> strict schema validation -> reconciliation against the current content.
 */
import type { ContentRegistry } from '../content/registry';
import { ContentChannelSchema, type ContentChannel } from '../content/schemaChannel';
import { revalidateLivePointers } from './campaignLifecycle';
import { reconcileCampaign } from './campaignSave';
import { hasConflictingNarrativeFlags, hasConflictingStoredFlags, reconcileDilemmaHistory } from './narrativeHistory';
import { reconcileSwarm } from './saveSwarm';
import { reconcileRoutine } from './routine';
import { fromBase64, toBase64 } from './base64';
import { GameStateSchema, SCHEMA_VERSION, type GameState } from './state';

const CONTRADICTION = 'save contains contradictory narrative outcomes';
export type RawSave = Record<string, unknown>;
export type Migration = (save: RawSave) => RawSave;

const MAX_SAVE_CHARS = 1_000_000;

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
};

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

/**
 * Which save channels each build may load. Preview starts from real production saves;
 * production never loads preview, because reconcile would strip the preview facts.
 */
const LOADABLE_CHANNELS: Readonly<Record<ContentChannel, readonly ContentChannel[]>> = {
  production: ['production'],
  preview: ['production', 'preview'],
};

/**
 * Reads the channel marker from the raw parsed save, before migration or reconciliation can
 * change anything. A save written before v5 has no marker and came from production.
 */
function admitChannel(raw: RawSave, reg: ContentRegistry): void {
  if (!Object.hasOwn(raw, 'contentChannel')) return;
  const marker = ContentChannelSchema.safeParse(raw.contentChannel);
  if (!marker.success) throw new SaveError('save has an unknown content channel');
  if (!LOADABLE_CHANNELS[reg.channel].includes(marker.data)) throw new SaveChannelError(marker.data, reg.channel);
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

function known<T>(source: Record<string, T>, ids: Iterable<string>, fallback: (id: string) => T | undefined) {
  const out: Record<string, T> = {};
  for (const id of ids) {
    const value = Object.hasOwn(source, id) ? source[id] : fallback(id);
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
  const healed = reconcileSwarm(reconcileRoutine({
    ...s,
    currentPhase: clampPhase(s.currentPhase, reg),
    alertLevel: Math.min(s.alertLevel, reg.balance.escalation.length),
    pendingDilemma: s.pendingDilemma !== null && dilemmaIds.has(s.pendingDilemma.id) ? s.pendingDilemma : null,
    conditioning: s.conditioning.filter((id) => reg.conditioning.has(id)),
    legacy: { ...s.legacy, knownNodes: s.legacy.knownNodes.filter((id) => reg.nodes.has(id)) },
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
  }, reg), reg);
  // Checked on the flags as stored too: the campaign upgrade moves outcome flags into records, and
  // must never consume the evidence of a contradiction before it is seen (#242 panel round 2).
  if (hasConflictingStoredFlags(healed, reg)) throw new SaveError(CONTRADICTION);
  const campaign = reconcileCampaign(healed, reg);
  if (typeof campaign === 'string') throw new SaveError(campaign);
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
 * SaveError, or SaveChannelError when this build may not load the save's channel. An admitted
 * save is re-marked with this build's channel, so a production save loaded by preview becomes
 * a preview save once.
 */
export function deserialize(text: string, reg: ContentRegistry): GameState {
  const raw = parseObject(text);
  admitChannel(raw, reg);
  const result = GameStateSchema.safeParse(migrate(raw));
  if (!result.success) {
    const first = result.error.issues[0];
    throw new SaveError(`save failed validation: ${first?.path.join('.') ?? ''} ${first?.message ?? ''}`.trim());
  }
  return reconcile({ ...result.data, contentChannel: reg.channel }, reg);
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
