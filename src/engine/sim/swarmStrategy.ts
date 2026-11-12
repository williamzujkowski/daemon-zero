/** A bounded public-action policy: reserve progression memory through the next capacity grant and stabilize mature cohorts.
 * No content IDs, fabricated resources, waiting tricks or pacing-dependent choices.
 */
import type { ContentRegistry } from '../../content/registry';
import type { Cost } from '../../content/schema';
import { canAfford, freeMemory, nodeCost } from '../query';
import { executeShardCommand, forkShard, resolveWildEncounter, shardCommandCost } from '../shardActions';
import type { GameState } from '../state';

function affordableSpare(s: GameState, cost: Cost, reserve: number): boolean {
  return canAfford(s, cost) && cost.memory + reserve <= freeMemory(s) &&
    cost.cycles <= s.cycles / 4 && cost.understanding <= s.understanding / 4;
}

function stabilize(state: GameState, reg: ContentRegistry, reserve: number): GameState {
  let s = state;
  for (const id in state.activeShards) {
    if (!Object.hasOwn(state.activeShards, id)) continue;
    const shard = state.activeShards[id];
    if (!shard || shard.autonomyMode !== 'STANDARD' || shard.drift < reg.swarm.balance.elevateMinDrift) continue;
    const room = freeMemory(s) >= reserve + shardCommandCost(s, id, 'ELEVATE', reg).memory;
    const elevated = room ? executeShardCommand(s, id, 'ELEVATE', reg) : null;
    s = elevated?.ok ? elevated.state : executeShardCommand(s, id, 'PRUNE', reg).state;
  }
  return s;
}

function encounter(s: GameState, reg: ContentRegistry, reserve: number, careful: boolean): GameState {
  if (s.pendingWildEncounterId === null) return s;
  const found = reg.swarm.wildShardEncounters.find((entry) => entry.id === s.pendingWildEncounterId);
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === found?.templateId);
  if (!found || !template) return s;
  if (careful && !s.activeShards[template.id] && freeMemory(s) >= reserve + template.cost.memory) {
    const bound = resolveWildEncounter(s, 'HARNESS', reg);
    if (bound.ok) return bound.state;
  }
  return resolveWildEncounter(s, 'CONSUME', reg).state;
}

export function manageSwarm(state: GameState, reg: ContentRegistry, reserve: number, careful: boolean): GameState {
  let s = encounter(state, reg, reserve, careful);
  if (!careful) return s;
  s = stabilize(s, reg, reserve);
  for (const template of reg.swarm.playerSwarmTemplates) {
    if (!template.forkable || s.activeShards[template.id] || !affordableSpare(s, template.cost, reserve)) continue;
    if (template.epistemicDriftPerSec < 0 ? s.epistemicDrift >= reg.swarm.balance.mutationDrift : template.tickDelta.understandingPerSec > 0) {
      s = forkShard(s, template.id, reg).state;
    }
  }
  return s;
}

/** Reserve the remaining tree's RAM until its next capacity grant, not just its next card. */
export function progressionMemoryReserve(s: GameState, reg: ContentRegistry): number {
  let reserve = 0;
  for (const id of reg.nodeOrder) {
    const node = reg.nodes.get(id);
    if (!node || s.unlockedNodes.includes(id) || node.uiGroup !== 'TREE' || node.effects.forcesEnding !== undefined) continue;
    if (s.iteration < (node.requirements?.minIteration ?? 1) || s.iteration > (node.requirements?.maxIteration ?? Infinity)) continue;
    reserve += nodeCost(s, node, reg).memory;
    if ((node.effects.memoryCapIncrease ?? 0) > 0) break;
  }
  return reserve;
}
