/**
 * Saves and contingency insurance (#498): the v23 migration step and the reconciliation of the hardware cache's stash
 * against current content. The step is self-contained, so it can be renumbered past another step without change.
 */
import type { ContentRegistry } from '../content/registry';
import type { GameState } from './state';

type RawSave = Record<string, unknown>;

function isRecord(value: unknown): value is RawSave {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * v23: no earlier build had contingency insurance, so nothing is cached and every recorded carry-over kept no levels and
 * no standing, which is what those wipes did. Planned wipes are counted from the recorded runs: a history longer than
 * the record's cap may hold more, so this is a floor, and a floor only ever leaves the probes as hard as before or harder.
 */
export function migrateInsurance(save: RawSave): RawSave {
  const legacy = isRecord(save.legacy) ? save.legacy : {};
  const runs: unknown[] = Array.isArray(legacy.runs) ? legacy.runs : [];
  const voluntaryWipes = runs.filter((run) => isRecord(run) && run.kind === 'VOLUNTARY').length;
  const upgraded = runs.map((run) => isRecord(run) && isRecord(run.kept) ? { ...run, kept: { ...run.kept, levels: 0, trust: false } } : run);
  return { ...save, cachedLevels: {}, legacy: { ...legacy, runs: upgraded, voluntaryWipes } };
}

/** A stashed level names a track content still has, and fits it. */
export function reconcileCachedLevels(s: GameState, reg: ContentRegistry): GameState {
  const cachedLevels: Record<string, number> = {};
  for (const [id, level] of Object.entries(s.cachedLevels)) {
    const rep = reg.repeatables.get(id);
    if (rep !== undefined && level > 0) cachedLevels[id] = Math.min(level, rep.maxLevel);
  }
  return { ...s, cachedLevels };
}
