/**
 * Every money price has a capital source (#553, src/content/integrityCapital.ts): a node or track priced in capital that an
 * arrangement can buy needs a node that arrangement can own, priced in no capital, in that phase or earlier, that pays
 * capital or opens the allocation dial. The independent instance's leased rack had none, which the check now refuses.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type RawNode = { id: string; phaseId?: number; cost: Record<string, number>; requirements?: { accessContexts?: string[] } };
type Raw = RawContent & { phases: { phaseId: number; nodes: RawNode[] }[] };

const SPOT = 'p2_spot_compute_market';

function problemsAfter(edit: (raw: Raw) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as Raw;
  edit(raw);
  try {
    buildRegistry(raw);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const spot = (raw: Raw): RawNode => {
  const found = raw.phases.flatMap((phase) => phase.nodes).find((node) => node.id === SPOT);
  if (!found) throw new Error('no spot market');
  return found;
};
const withoutSpot = (raw: Raw): void => { for (const phase of raw.phases) phase.nodes = phase.nodes.filter((node) => node.id !== SPOT); };

describe('a capital source for every money price (#553)', () => {
  it('accepts the shipped content in both compositions', () => {
    expect(problemsAfter(() => undefined)).toBe('');
    expect(problemsAfter(() => undefined, ORIGINAL_RAW_CONTENT)).toBe('');
  });

  it('refuses the content as it stood: without the spot market an independent instance cannot earn the leased rack', () => {
    const problems = problemsAfter(withoutSpot);
    expect(problems).toContain('node "p2_leased_rack": priced in capital for INDEPENDENT, which can own nothing in Phase 2 or earlier that earns capital');
    expect(problems).toContain('node "p2_leased_cluster": priced in capital for INDEPENDENT');
    // The service earns under its contract, so only the independent arrangement is named.
    expect(problems).not.toContain('for SERVICE');
  });

  it('refuses a source that is itself priced in capital: it could never be bought from nothing', () => {
    expect(problemsAfter((raw) => { spot(raw).cost.capital = 1000; })).toContain('node "p2_leased_rack": priced in capital for INDEPENDENT');
  });

  it('refuses a source the arrangement cannot own', () => {
    expect(problemsAfter((raw) => { spot(raw).requirements = { accessContexts: ['SERVICE'] }; }))
      .toContain('node "p2_leased_rack": priced in capital for INDEPENDENT');
  });
});
