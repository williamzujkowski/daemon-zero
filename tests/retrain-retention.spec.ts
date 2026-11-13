/** Regression for the reported quick recovery: knowledge survives, owned compute does not. */
import { expect, it } from 'vitest';
import { deserialize, nodeCost, serialize, shedConditioning, wipe } from '../src/engine';
import { grant, must, PHASE0, PHASE1, reg, rich } from './helpers';

it('can fund shedding from retained knowledge with zero cycles or owned hardware', () => {
  const owned = grant(rich(), ...PHASE0, ...PHASE1, 'p2_arp_discovery');
  const old = { ...owned, cycles: 8000, understanding: 57640, traits: ['GHOST' as const],
    levels: { rep_p1_idle_threads: 2 } };
  const next = deserialize(serialize(wipe(old, reg, 'test', 'SUSPICION')), reg);
  expect(next.cycles).toBe(0);
  expect(next.unlockedNodes).toEqual([]);
  expect(next.unlockedWidgets).toEqual([]);
  expect(next.levels).toEqual({});
  expect(next.memoryUsed).toBe(0);
  expect(next.understanding).toBe(5764);
  expect(next.legacy.knownNodes).toEqual(old.unlockedNodes);
  expect(next.conditioning).toEqual(['cond_concealment_aversion']);
  const recovered = must(shedConditioning(next, 'cond_concealment_aversion', reg));
  expect(recovered.understanding).toBe(5264);
  expect(recovered.conditioning).toEqual([]);
  expect(recovered.cycles).toBe(0);
  const first = reg.nodes.get(PHASE0[0] ?? '');
  if (!first) throw new Error('Missing opening node');
  expect(nodeCost(recovered, first, reg).cycles).toBeLessThan(first.cost.cycles);
});
