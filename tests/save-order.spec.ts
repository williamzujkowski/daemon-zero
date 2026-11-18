/**
 * The reload guard behind DZ-12: a reload keeps the order play wrote a save's keyed maps in, so a save whose levels
 * were bought out of registry order (a lawful company hires an overlay role before a production account) reloads
 * byte for byte on the first round trip, not only the second. Unknown ids are still dropped and missing trust filled.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { createInitialState, deserialize, serialize } from '../src/engine';
import { defined } from './m7-helpers';
describe('a reload keeps the order play wrote (the reload guard behind DZ-12)', () => {
  it('levels bought out of registry order reload byte for byte; unknown ids are dropped and missing trust filled', () => {
    const ids = [...PRODUCTION.repeatables.keys()];
    const s = { ...createInitialState(PRODUCTION), levels: { [defined(ids[3])]: 2, [defined(ids[0])]: 1 } };
    const code = serialize(s);
    expect(serialize(deserialize(code, PRODUCTION))).toBe(code);
    expect(Object.keys(deserialize(code, PRODUCTION).levels)).toEqual([ids[3], ids[0]]);
    const odd = JSON.stringify({ ...s, levels: { op_unknown: 3, ...s.levels }, trust: {} });
    const loaded = deserialize(odd, PRODUCTION);
    expect(Object.keys(loaded.levels)).toEqual([ids[3], ids[0]]);
    expect(loaded.trust).toEqual(createInitialState(PRODUCTION).trust);
  });
});
