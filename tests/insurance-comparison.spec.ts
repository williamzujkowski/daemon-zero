/**
 * The no-insurance comparison is reproducible from the tree (#524, `make sim-insurance`): `withoutInsurance` builds the
 * shipped composition with exactly its insuring nodes taken out, validated like any other, and leaves the content it
 * was given untouched.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, RAW_CONTENT } from '../src/content';
import { withoutInsurance } from '../src/engine/sim/insuranceComparison';

const insuring = [...CONTENT.nodes.values()].filter((node) => node.insures !== undefined).map((node) => node.id);

describe('the no-insurance composition (#524)', () => {
  it('removes every insuring node and nothing else', () => {
    expect(insuring.length).toBeGreaterThan(0);
    const bare = withoutInsurance(RAW_CONTENT);
    expect([...bare.nodes.values()].filter((node) => node.insures !== undefined)).toEqual([]);
    expect([...bare.nodes.keys()]).toEqual([...CONTENT.nodes.keys()].filter((id) => !insuring.includes(id)));
    expect([...bare.repeatables.keys()]).toEqual([...CONTENT.repeatables.keys()]);
    expect(bare.dilemmas.map((dilemma) => dilemma.id)).toEqual(CONTENT.dilemmas.map((dilemma) => dilemma.id));
  });

  it('leaves the raw content it was given untouched', () => {
    const before = JSON.stringify(RAW_CONTENT);
    withoutInsurance(RAW_CONTENT);
    expect(JSON.stringify(RAW_CONTENT)).toBe(before);
  });
});
