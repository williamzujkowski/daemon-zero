/** Reconcile v4 references without granting resources or retaining orphaned shard reservations. */
import type { ContentRegistry } from '../content/registry';
import type { GameState } from './state';
import { refreshAnomaly } from './swarmEffects';

export function reconcileSwarm(s: GameState, reg: ContentRegistry): GameState {
  let released = 0;
  const activeShards: GameState['activeShards'] = {};
  for (const [id, shard] of Object.entries(s.activeShards)) {
    const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId);
    if (!template || id !== template.id) { released += shard.memoryAllocatedBytes; continue; }
    const count = Math.min(shard.count, template.maxCount);
    const memoryAllocatedBytes = shard.memoryAllocatedBytes * count / shard.count;
    released += shard.memoryAllocatedBytes - memoryAllocatedBytes;
    const quirkId = reg.swarm.shardQuirks.some((entry) => entry.id === shard.quirkId) ? shard.quirkId : null;
    activeShards[id] = { ...shard, count, memoryAllocatedBytes, quirkId,
      drift: shard.autonomyMode === 'STANDARD' ? shard.drift : 0 };
  }
  const actionCounts = Object.fromEntries(Object.entries(s.actionCounts).filter(([id]) => reg.actions.has(id))
    .map(([id, count]) => [id, Math.min(count, reg.actions.get(id)?.maxPurchases ?? count)]));
  const actionEffectUntil = Object.fromEntries(Object.entries(s.actionEffectUntil).filter(([id]) => reg.actions.get(id)?.durationSec !== undefined));
  const pending = [...reg.swarm.wildShardEncounters, ...reg.swarm.channelEncounters].some((entry) => entry.id === s.pendingWildEncounterId);
  const d = { ...s, activeShards, actionCounts, actionEffectUntil,
    memoryUsed: Math.max(0, s.memoryUsed - released),
    narrativeFlags: [...new Set(s.narrativeFlags.filter((flag) => reg.swarm.narrativeFlags.includes(flag)))],
    pendingWildEncounterId: pending ? s.pendingWildEncounterId : null };
  refreshAnomaly(d, reg);
  return reconcileHostile(d, reg);
}

/** A pressing hostile content no longer declares is dropped, and the memory it pinned returns (#491). */
function reconcileHostile(s: GameState, reg: ContentRegistry): GameState {
  const active = s.hostile.active;
  if (active === null || reg.swarm.hostileEncounters.some((entry) => entry.id === active.id)) return s;
  return { ...s, memoryUsed: Math.max(0, s.memoryUsed - active.pinnedBytes), hostile: { ...s.hostile, active: null } };
}
