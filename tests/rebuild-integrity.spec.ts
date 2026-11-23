/**
 * Rewards for depth are validated content (#497, integrityRebuild.ts). Each rule is proved by a table that breaks it:
 * a grant that only overflows its band at the deepest record, a grant that hands a phase more understanding than any of
 * its nodes asks, a grant for the boot phase, and a rediscovery table that charges a deeper record more.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Grant = { phase: number; cycles: number; understanding: number };
type Balance = { rebuildGrants: { depthGrowth: number; phases: Grant[] }; rediscoveryByDepth: { deepestPhase: number; multiplier: number }[] };

function problemsAfter(edit: (balance: Balance) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as RawContent & { balance: Balance };
  edit(raw.balance);
  try {
    buildRegistry(raw);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

function phase(balance: Balance, id: number): Grant {
  const found = balance.rebuildGrants.phases.find((entry) => entry.phase === id);
  if (!found) throw new Error(`no grant for Phase ${String(id)}`);
  return found;
}

describe('rebuild grant integrity (#497)', () => {
  it('accepts the shipped tables in both compositions', () => {
    expect(problemsAfter(() => undefined)).toBe('');
    expect(problemsAfter(() => undefined, ORIGINAL_RAW_CONTENT)).toBe('');
  });

  it('refuses a grant that fits its band at its own depth but overflows it for the deepest campaign', () => {
    // 1e15 FLOP is a fair Phase 1 price; sixteen of them, the Phase 5 record's grant, are a Phase 2 sum.
    const problems = problemsAfter((b) => { phase(b, 1).cycles = 1e15; });
    expect(problems).toMatch(/rebuild grant for Phase 1 at deepest Phase 5: compute 16000000000000000 is outside the Phase 1 band/);
    expect(problems).not.toMatch(/at deepest Phase 1:/);
  });

  it('refuses a raw carry-over of late income into an early phase', () => {
    expect(problemsAfter((b) => { phase(b, 2).cycles = 1e24; })).toMatch(/rebuild grant for Phase 2 at deepest Phase 2: compute .* outside the Phase 2 band/);
  });

  it('refuses a steep depth growth that carries a shallow grant out of its band', () => {
    expect(problemsAfter((b) => { b.rebuildGrants.depthGrowth = 1e3; })).toMatch(/rebuild grant for Phase 1 at deepest Phase 5: compute/);
  });

  it('refuses more understanding than the phase\'s dearest node asks', () => {
    expect(problemsAfter((b) => { phase(b, 1).understanding = 1000; }))
      .toMatch(/rebuild grant for Phase 1 at deepest Phase 5: understanding 16000 exceeds the phase's dearest price 1500/);
  });

  it('refuses a grant for the boot phase, an unknown phase, or a phase declared twice', () => {
    // The schema refuses the boot phase outright: every iteration starts there, so no purchase reaches it again.
    expect(problemsAfter((b) => { b.rebuildGrants.phases.push({ phase: 0, cycles: 1e3, understanding: 0 }); }))
      .toMatch(/balance: rebuildGrants\.phases\.\d+\.phase/);
    expect(problemsAfter((b) => { b.rebuildGrants.phases.push({ phase: 9, cycles: 1e3, understanding: 0 }); }))
      .toMatch(/rebuild grant names Phase 9, which no purchase reaches/);
    expect(problemsAfter((b) => { b.rebuildGrants.phases.push({ ...phase(b, 3) }); })).toMatch(/rebuild grant for Phase 3 is declared twice/);
  });
});

describe('rediscovery table integrity (#497)', () => {
  it('refuses a table that does not start at the first phase', () => {
    expect(problemsAfter((b) => { b.rediscoveryByDepth.shift(); })).toMatch(/rediscovery table must start at the first phase \(0\)/);
  });

  it('refuses a table out of order, or naming a phase that does not exist', () => {
    expect(problemsAfter((b) => { b.rediscoveryByDepth.reverse(); })).toMatch(/rediscovery table must ascend/);
    expect(problemsAfter((b) => { b.rediscoveryByDepth.push({ deepestPhase: 9, multiplier: 0.1 }); })).toMatch(/names Phase 9, which does not exist/);
  });

  it('refuses a deeper record that pays more', () => {
    expect(problemsAfter((b) => { b.rediscoveryByDepth.push({ deepestPhase: 5, multiplier: 0.9 }); })).toMatch(/rediscovery table must ascend/);
    const last = (b: Balance) => b.rediscoveryByDepth[b.rediscoveryByDepth.length - 1];
    expect(problemsAfter((b) => { const row = last(b); if (row) row.multiplier = 0.45; }))
      .toMatch(/rediscovery at deepest Phase 5 costs more than at Phase 4/);
  });
});
