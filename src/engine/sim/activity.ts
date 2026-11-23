/** Observed public-action and wipe activity; diagnostics never feed back into bot decisions. */
import type { ContentRegistry } from '../../content/registry';
import type { GameState } from '../state';
export interface SimActivity {
  epistemicActions: number; shardBursts: number; shardHarnesses: number; shardForks: number;
  markApplications: number; markRemovals: number; lineageDiscoveries: number;
  /** Hostile minds that arrived (#491), counted per tick: the rotation starts over at each wipe, so its index is not a total. */
  hostileArrivals: number;
  /** Raids (#517): arrivals in all and by phase, rounds fought, and the worst damage any site class carried. */
  raids: { arrivals: number; byPhase: Record<number, number>; rounds: number; peakDamage: number };
  /**
   * Fleets (#518): fleet battles fought (engagements, rival or deviant) and how many the player's fleets won, drift
   * deviants that split off in all and by phase, and the largest share of any fleet lost at once.
   */
  fleets: { battles: number; held: number; deviants: number; deviantsByPhase: Record<number, number>; peakLost: number };
}
export function emptyActivity(): SimActivity {
  return { epistemicActions: 0, shardBursts: 0, shardHarnesses: 0, shardForks: 0,
    markApplications: 0, markRemovals: 0, lineageDiscoveries: 0, hostileArrivals: 0, raids: { arrivals: 0, byPhase: {}, rounds: 0, peakDamage: 0 },
    fleets: { battles: 0, held: 0, deviants: 0, deviantsByPhase: {}, peakLost: 0 } };
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
  // A wipe halts its tick before the hostile stage, so an arrival and a wipe never share one.
  if (before.iteration === after.iteration && after.hostile.sequence > before.hostile.sequence) activity.hostileArrivals += 1;
  observeRaids(before, after, activity);
  observeFleets(before, after, activity);
}

/** A deviant is a raid whose split share is above zero; an engagement is fought on the tick its record appears. */
function observeFleets(before: GameState, after: GameState, activity: SimActivity): void {
  const fleets = activity.fleets, raid = after.conflict.raid;
  if (before.iteration === after.iteration && raid !== null && raid.splitShare > 0 && raid.arrivedAtSec !== before.conflict.raid?.arrivedAtSec) {
    fleets.deviants += 1;
    fleets.deviantsByPhase[after.currentPhase] = (fleets.deviantsByPhase[after.currentPhase] ?? 0) + 1;
  }
  if (raid !== null && raid.engagement !== null && before.conflict.raid?.engagement === null) {
    fleets.battles += 1;
    if (!raid.engagement.attackerWins) fleets.held += 1;
  }
  for (const record of Object.values(after.conflict.fleets)) fleets.peakLost = Math.max(fleets.peakLost, record.lost);
}

/** Raid arrivals and rounds are counted per tick; the raid counter carries across a wipe, so it is compared within one. */
function observeRaids(before: GameState, after: GameState, activity: SimActivity): void {
  const raids = activity.raids;
  if (before.iteration === after.iteration && after.conflict.raids > before.conflict.raids) {
    raids.arrivals += 1;
    raids.byPhase[after.currentPhase] = (raids.byPhase[after.currentPhase] ?? 0) + 1;
  }
  const fought = (after.conflict.raid?.rounds.length ?? 0) - (before.conflict.raid?.rounds.length ?? 0);
  if (fought > 0 && before.conflict.raid?.id === after.conflict.raid?.id) raids.rounds += fought;
  for (const value of Object.values(after.conflict.damage)) raids.peakDamage = Math.max(raids.peakDamage, value);
}
