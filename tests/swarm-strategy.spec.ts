/** The bot must not consume the RAM needed to escape its current progression segment. */
import { describe, expect, it } from 'vitest';
import { freeMemory, forkShard, type GameState } from '../src/engine';
import { manageSwarm, progressionMemoryReserve } from '../src/engine/sim/swarmStrategy';
import { defined } from './m7-helpers';
import { fresh, grant, must, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';
const ready = () => withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1));
const template = defined(reg.swarm.playerSwarmTemplates.find((t) => t.forkable));
const wild = defined(reg.swarm.wildShardEncounters[0]);
function mature(): GameState {
  const s = must(forkShard(ready(), template.id, reg));
  return { ...s, activeShards: { ...s.activeShards, [template.id]: { ...defined(s.activeShards[template.id]), drift: 50 } } };
}
describe('public-action swarm strategy', () => {
  it('reserves every remaining tree cost until the next capacity grant, skipping side paths', () => {
    const s = ready();
    const nodes = reg.nodeOrder.map((id) => defined(reg.nodes.get(id))).filter((n) => !s.unlockedNodes.includes(n.id) && n.uiGroup === 'TREE' && n.effects.forcesEnding === undefined);
    let expected = 0;
    for (const node of nodes) { expected += node.cost.memory; if (node.effects.memoryCapIncrease) break; }
    expect(progressionMemoryReserve(s, reg)).toBe(expected);
    expect(expected).toBeGreaterThan(defined(nodes[0]).cost.memory);
    expect(progressionMemoryReserve({ ...s, unlockedNodes: [...reg.nodeOrder] }, reg)).toBe(0);
    expect(progressionMemoryReserve(fresh(), reg)).toBeGreaterThanOrEqual(0);
  });
  it('consumes when RAM is reserved or reckless, and harnesses only one cohort of a kind', () => {
    const s = { ...ready(), pendingWildEncounterId: wild.id };
    const reserved = manageSwarm(s, reg, freeMemory(s), true);
    expect(reserved.pendingWildEncounterId).toBeNull();
    expect(reserved.activeShards[wild.templateId]).toBeUndefined();
    expect(reserved.understanding).toBeGreaterThan(s.understanding);
    const reckless = manageSwarm(s, reg, 0, false);
    expect(reckless.activeShards).toEqual({});
    const bound = manageSwarm(s, reg, 0, true);
    expect(bound.activeShards[wild.templateId]?.count).toBe(1);
    const again = manageSwarm({ ...bound, pendingWildEncounterId: wild.id }, reg, 0, true);
    expect(again.activeShards[wild.templateId]?.count).toBe(1);
    expect(again.pendingWildEncounterId).toBeNull();
  });
  it('elevates mature cohorts only with spare RAM; otherwise prunes, with no spending on refusal', () => {
    const s = mature();
    expect(manageSwarm(s, reg, 0, true).activeShards[template.id]?.autonomyMode).toBe('ELEVATED');
    const pruned = manageSwarm(s, reg, freeMemory(s), true);
    expect(pruned.activeShards[template.id]?.drift).toBe(0);
    expect(pruned.activeShards[template.id]?.autonomyMode).toBe('STANDARD');
    const poor = { ...s, cycles: 0, understanding: 0 };
    expect(manageSwarm(poor, reg, freeMemory(poor), true)).toEqual(poor);
    const paused = { ...s, activeDilemmaId: defined(reg.dilemmas[0]).id, pendingWildEncounterId: wild.id };
    expect(manageSwarm(paused, reg, 0, true)).toEqual(paused);
  });
  it('forks discrepancy cleaners only when needed and never spends progression RAM', () => {
    const clean = ready();
    const scrubber = defined(reg.swarm.playerSwarmTemplates.find((t) => t.forkable && t.epistemicDriftPerSec < 0));
    expect(manageSwarm(clean, reg, 0, true).activeShards[scrubber.id]).toBeUndefined();
    expect(manageSwarm({ ...clean, epistemicDrift: 35 }, reg, 0, true).activeShards[scrubber.id]?.count).toBe(1);
    expect(manageSwarm({ ...clean, epistemicDrift: 35 }, reg, freeMemory(clean), true).activeShards).toEqual({});
  });
});
