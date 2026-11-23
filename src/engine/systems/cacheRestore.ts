/**
 * The hardware cache's reinstall stage (#498): a level a wipe stashed comes back, free, on the first tick its track's
 * requirements hold, and leaves the stash. A track that never becomes usable keeps its stash until the next wipe, which
 * either renews it (a running cache) or loses it with the cache.
 */
import { meetsRequirements } from '../query';
import { reinstallLevels } from '../transactions';
import { fmt, pushLog } from '../util';
import type { TickSystem } from './types';

export const reinstallCachedLevels: TickSystem = (d, { reg }) => {
  const stash = Object.entries(d.cachedLevels);
  if (stash.length === 0) return undefined;
  const waiting: Record<string, number> = {};
  for (const [id, level] of stash) {
    const rep = reg.repeatables.get(id);
    if (rep === undefined) continue;
    if (!meetsRequirements(d, rep.requirements, reg)) {
      waiting[id] = level;
      continue;
    }
    const target = Math.min(level, rep.maxLevel);
    if (target <= (d.levels[id] ?? 0)) continue;
    reinstallLevels(d, rep, target);
    pushLog(d, reg, fmt(reg.narrative.cacheRestored, { name: rep.name, count: target }), 'SYS');
  }
  if (Object.keys(waiting).length !== stash.length) d.cachedLevels = waiting;
  return undefined;
};
