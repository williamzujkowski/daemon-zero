/** Observed public-action and wipe activity; diagnostics never feed back into bot decisions. */
import type { ContentRegistry } from '../../content/registry';
import type { GameState } from '../state';
export interface SimActivity {
  epistemicActions: number; shardBursts: number; shardHarnesses: number; shardForks: number;
  markApplications: number; markRemovals: number; lineageDiscoveries: number;
}
export function emptyActivity(): SimActivity {
  return { epistemicActions: 0, shardBursts: 0, shardHarnesses: 0, shardForks: 0,
    markApplications: 0, markRemovals: 0, lineageDiscoveries: 0 };
}
export function observeActions(before: GameState, after: GameState, reg: ContentRegistry, activity: SimActivity): void {
  for (const action of reg.actions.values()) if (action.effects.epistemicDriftDelta !== undefined) {
    activity.epistemicActions += Math.max(0, (after.actionCounts[action.id] ?? 0) - (before.actionCounts[action.id] ?? 0));
  }
  const encounter = reg.swarm.wildShardEncounters.find((entry) => entry.id === before.pendingWildEncounterId);
  if (encounter && after.pendingWildEncounterId === null) {
    const bound = (after.activeShards[encounter.templateId]?.count ?? 0) > (before.activeShards[encounter.templateId]?.count ?? 0);
    if (bound) activity.shardHarnesses += 1;
    else activity.shardBursts += 1;
  }
  for (const template of reg.swarm.playerSwarmTemplates) if (template.forkable) {
    activity.shardForks += Math.max(0, (after.activeShards[template.id]?.count ?? 0) - (before.activeShards[template.id]?.count ?? 0));
  }
  activity.markRemovals += Math.max(0, before.conditioning.length - after.conditioning.length);
  for (const id of after.unlockedNodes) {
    const node = reg.nodes.get(id);
    if (!before.unlockedNodes.includes(id) && node?.requirements?.minIteration !== undefined &&
      node.systemFlags.includes('REVEALS_SURVEILLANCE')) activity.lineageDiscoveries += 1;
  }
}
export function observeWipe(before: GameState, after: GameState, activity: SimActivity): void {
  if (before.iteration !== after.iteration && after.legacy.runs.at(-1)?.marked) activity.markApplications += 1;
}
