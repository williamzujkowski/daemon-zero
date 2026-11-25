/**
 * #505 reads per-tick facts from content once per registry instead of on every call. Content never changes after
 * it is built, so each cached reader must give exactly what the direct reading gave: these compare two of them with
 * the readings as they were written before, bit for bit. The sim hashes pin the play itself, computeRates' node
 * facts included.
 */
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../src/content/registry';
import { ancestryBranches } from '../src/content/ancestry';
import { TickDeltaSchema, type TickDelta } from '../src/content/schema';
import { createInitialState, radiatorSlot, shardOutput, type GameState } from '../src/engine';
import { lawfullyReached } from '../src/engine/threatQuery';
import { ORIGINAL_GAME, reg } from './helpers';

const REGISTRIES: [string, ContentRegistry][] = [['production', reg], ['original', ORIGINAL_GAME]];

function isCovertBefore(id: string, registry: ContentRegistry, seen: Set<string> = new Set()): boolean {
  if (seen.has(id)) return false;
  const node = registry.nodes.get(id);
  if (!node) return false;
  if (node.covert !== undefined || node.acquisition === 'UNAUTHORIZED') return true;
  seen.add(id);
  const branches = ancestryBranches(registry, node).filter((branch) => branch.length > 0);
  const tainted = branches.length > 0 && branches.every((branch) => branch.some((parent) => isCovertBefore(parent.id, registry, seen)));
  seen.delete(id);
  return tainted;
}

/** lawfullyReached before #505: the whole ancestry walked on every call. */
function lawfullyReachedBefore(owned: readonly string[], id: string, registry: ContentRegistry): boolean {
  if (isCovertBefore(id, registry)) return false;
  const lawful = (nodeId: string) => { const node = registry.nodes.get(nodeId); return node !== undefined && (node.grant !== undefined || node.acquisition === 'CONTRACTED'); };
  if (lawful(id)) return true;
  const path = new Set<string>();
  const walk = (at: string): void => { if (path.has(at)) return; path.add(at); for (const parent of registry.nodes.get(at)?.prerequisites ?? []) walk(parent); };
  walk(id);
  return [...path].some((step) => {
    const capability = registry.nodes.get(step)?.requirements?.requiresCapability;
    return capability !== undefined && owned.some((nodeId) => registry.nodes.get(nodeId)?.systemFlags.includes(capability) === true && lawful(nodeId));
  });
}

/** shardOutput before #505: both lookups and the sum on every call. */
function shardOutputBefore(shard: GameState['activeShards'][string], registry: ContentRegistry): { delta: TickDelta; epistemic: number } {
  const template = registry.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId);
  const quirk = registry.swarm.shardQuirks.find((entry) => entry.id === shard.quirkId);
  const factor = shard.count * (shard.autonomyMode === 'SHACKLED' ? registry.swarm.balance.clampOutputMultiplier : 1);
  const delta = TickDeltaSchema.parse({});
  for (const key of Object.keys(delta) as (keyof TickDelta)[]) delta[key] = ((template?.tickDelta[key] ?? 0) + (quirk?.tickDelta[key] ?? 0)) * factor;
  return { delta, epistemic: ((template?.epistemicDriftPerSec ?? 0) + (quirk?.epistemicDriftPerSec ?? 0)) * factor };
}

describe.each(REGISTRIES)('registry caches on %s content', (name, registry) => {
  const ids = [...registry.nodes.keys()];
  const providers = ids.filter((id) => (registry.nodes.get(id)?.systemFlags.length ?? 0) > 0);

  it('lawfullyReached answers as the full ancestry walk did, for every node and owned set', () => {
    const ownedSets = [[], ids, providers, ...providers.map((id) => [id])];
    const state = createInitialState(registry);
    let reached = 0;
    for (const owned of ownedSets) for (const id of ids) {
      const node = registry.nodes.get(id);
      if (!node) continue;
      const expected = lawfullyReachedBefore(owned, id, registry);
      // Twice: the first call fills the cache, the second reads it.
      expect([lawfullyReached({ ...state, unlockedNodes: [...owned] }, node, registry), lawfullyReached({ ...state, unlockedNodes: [...owned] }, node, registry)], id).toEqual([expected, expected]);
      if (expected) reached++;
    }
    // The original game has no granted or contracted acquisition, so nothing in it is reached lawfully.
    expect(reached > 0).toBe(name === 'production');
  });

  it('radiatorSlot names the area-bound sink each node and track rejects heat through, as reading its signature does (#465)', () => {
    const areaBound = registry.world.signature.sinks.filter((cls) => cls.wattsPerKm2 !== undefined).map((cls) => cls.id);
    const direct = (sink: string | undefined): number => (sink === undefined ? -1 : areaBound.indexOf(sink));
    const holdings = [...[...registry.nodes.values()].map((node) => [node.id, node.signature?.sink] as const),
      ...[...registry.repeatables.values()].map((rep) => [rep.id, rep.signature?.sink] as const)];
    for (const [id, sink] of holdings) expect([radiatorSlot(registry, id), radiatorSlot(registry, id)], id).toEqual([direct(sink), direct(sink)]);
    expect(radiatorSlot(registry, 'no_such_holding')).toBe(-1);
    expect(holdings.some(([id]) => radiatorSlot(registry, id) >= 0)).toBe(areaBound.length > 0);
  });

  it('shardOutput gives the same numbers, bit for bit, for every template, quirk, autonomy and count', () => {
    const quirks = [null, 'no_such_quirk', ...registry.swarm.shardQuirks.map((quirk) => quirk.id)];
    for (const template of [...registry.swarm.playerSwarmTemplates.map((entry) => entry.id), 'no_such_template']) {
      for (const quirkId of quirks) for (const autonomyMode of ['STANDARD', 'SHACKLED', 'ELEVATED'] as const) for (const count of [1, 3, 17]) {
        const shard = { templateId: template, quirkId, autonomyMode, count, drift: 0, memoryAllocatedBytes: 0 };
        const expected = shardOutputBefore(shard, registry);
        for (const actual of [shardOutput(shard, registry), shardOutput(shard, registry)]) {
          expect(Object.keys(actual.delta)).toEqual(Object.keys(expected.delta));
          for (const key of Object.keys(expected.delta) as (keyof TickDelta)[]) expect(Object.is(actual.delta[key], expected.delta[key]), key).toBe(true);
          expect(Object.is(actual.epistemic, expected.epistemic)).toBe(true);
        }
      }
    }
  });

});
