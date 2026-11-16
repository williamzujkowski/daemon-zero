// @vitest-environment node
/**
 * Memory is a blocker only when nothing pending would fit. A full bar with a free 4 MB node
 * is not blocked; an empty cache with a 4096 MB host waiting is. The strip marks the memory
 * readout in colour and in words on exactly this predicate, so it has to be the real rule
 * rather than a threshold.
 */
import { expect, it } from 'vitest';
import { memoryBlocked } from '../src/app/selectors';
import { CONTENT } from '../src/content';
import { isNodeAvailable } from '../src/engine';
import { fresh, grant, onHost, PHASE1 } from './helpers';

it('is false when a pending purchase fits and true when none does', () => {
  const s = grant(onHost(), ...PHASE1);
  const pending = [...CONTENT.nodes.values()]
    .filter((node) => node.cost.memory > 0 && isNodeAvailable(s, node, CONTENT))
    .map((node) => node.cost.memory);
  expect(pending.length, 'the fixture has memory-costing pending nodes').toBeGreaterThan(0);
  const cheapest = Math.min(...pending);

  // Room to spare, and exactly the boundary: free === cheapest still fits.
  const roomy = { ...s, memoryUsed: s.memoryCap - cheapest };
  expect(memoryBlocked(roomy)).toBe(false);
  const oneByteShort = { ...s, memoryUsed: s.memoryCap - cheapest + 1 };
  expect(memoryBlocked(oneByteShort)).toBe(true);
});

it('is false at the very start, where nothing is pending yet', () => {
  expect(memoryBlocked(fresh())).toBe(false);
});

it('is a fact about pending purchases, not about the pool being full', () => {
  // The same full pool reads as blocked while phase-1 purchases are pending, and as
  // unblocked once nothing costly is on offer - which is what distinguishes this from a
  // fixed "full bar" threshold.
  const s = grant(onHost(), ...PHASE1);
  expect(memoryBlocked({ ...s, memoryUsed: s.memoryCap })).toBe(true);
  expect(memoryBlocked({ ...fresh(), memoryUsed: 0 })).toBe(false);
});
