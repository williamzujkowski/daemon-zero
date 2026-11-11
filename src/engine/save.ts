/**
 * Save codec. A save is untrusted input (it can be pasted in by hand), so
 * loading always runs: size check -> JSON parse -> version migration -> strict
 * schema validation -> reconciliation against the current content.
 */
import type { ContentRegistry } from '../content/registry';
import { fromBase64, toBase64 } from './base64';
import { GameStateSchema, SCHEMA_VERSION, type GameState } from './state';

export type RawSave = Record<string, unknown>;
export type Migration = (save: RawSave) => RawSave;

const MAX_SAVE_CHARS = 1_000_000;

/**
 * MIGRATIONS[n] upgrades a version-n save to version n+1. When GameState
 * changes: bump SCHEMA_VERSION in state.ts and add the upgrade step here.
 * Never edit an existing step; players may still hold saves of any old version.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
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
};

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
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

/** Drops references to content that no longer exists so an old save loads against new content. */
export function reconcile(s: GameState, reg: ContentRegistry): GameState {
  const levels = known(s.levels, reg.repeatables.keys(), () => undefined);
  for (const [id, level] of Object.entries(levels)) {
    levels[id] = Math.min(level, reg.repeatables.get(id)?.maxLevel ?? 0);
  }
  const dilemmaIds = new Set(reg.dilemmas.map((dilemma) => dilemma.id));
  const activeKnown = s.activeDilemmaId !== null && dilemmaIds.has(s.activeDilemmaId);
  const endingKnown = s.ending !== null && reg.endings.some((ending) => ending.id === s.ending);
  return {
    ...s,
    currentPhase: clampPhase(s.currentPhase, reg),
    alertLevel: Math.min(s.alertLevel, reg.balance.escalation.length),
    pendingDilemma: s.pendingDilemma !== null && dilemmaIds.has(s.pendingDilemma.id) ? s.pendingDilemma : null,
    legacy: { ...s.legacy, knownNodes: s.legacy.knownNodes.filter((id) => reg.nodes.has(id)) },
    ending: endingKnown ? s.ending : null,
    unlockedNodes: s.unlockedNodes.filter((id) => reg.nodes.has(id)),
    disabledNodes: s.disabledNodes.filter((id) => reg.nodes.has(id)),
    unlockedWidgets: s.unlockedWidgets.filter((id) => reg.widgets.has(id)),
    levels,
    trust: known(s.trust, reg.factions.keys(), (id) => reg.factions.get(id)?.initialTrust),
    cooldowns: known(s.cooldowns, reg.actions.keys(), () => undefined),
    activeDilemmaId: activeKnown ? s.activeDilemmaId : null,
    resolvedDilemmas: s.resolvedDilemmas.filter((id) => dilemmaIds.has(id)),
    logs: s.logs.slice(0, reg.balance.maxLogEntries),
  };
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

/** Parses, migrates, validates and reconciles a serialized save. Throws SaveError. */
export function deserialize(text: string, reg: ContentRegistry): GameState {
  const migrated = migrate(parseObject(text));
  const result = GameStateSchema.safeParse(migrated);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new SaveError(`save failed validation: ${first?.path.join('.') ?? ''} ${first?.message ?? ''}`.trim());
  }
  return reconcile(result.data, reg);
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
