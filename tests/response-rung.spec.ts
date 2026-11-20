/** The response rung for a suspicion (#382): the rule the escalation system climbs by, shared with review fixtures. */
import { describe, expect, it } from 'vitest';
import { reachable } from '../scripts/reachable-fixture';
import { CONTENT } from '../src/content';
import { createInitialState, responseRungFor, tick } from '../src/engine';

const rungs = CONTENT.balance.escalation;

describe('responseRungFor', () => {
  it('counts the rungs at or below the suspicion', () => {
    expect(responseRungFor(0, CONTENT)).toBe(0);
    for (const [index, rung] of rungs.entries()) {
      expect(responseRungFor(rung.at - 0.01, CONTENT)).toBe(index);
      expect(responseRungFor(rung.at, CONTENT)).toBe(index + 1);
    }
    expect(responseRungFor(100, CONTENT)).toBe(rungs.length);
  });

  it('is where the escalation system climbs to in one tick from a patched save', () => {
    const patched = { ...createInitialState(CONTENT), suspicion: 60 };
    expect(patched.alertLevel).toBe(0);
    expect(tick(patched, 1 / CONTENT.balance.tickHz, CONTENT).alertLevel).toBe(responseRungFor(60, CONTENT));
  });
});

describe('reachable review fixtures', () => {
  it('lifts a trailing rung to what one tick shows and keeps a higher one', () => {
    const patched = { ...createInitialState(CONTENT), suspicion: 60 };
    expect(reachable(patched).alertLevel).toBe(responseRungFor(60, CONTENT));
    expect(reachable({ ...patched, alertLevel: rungs.length }).alertLevel).toBe(rungs.length);
  });

  it('stores the rates one tick would store, without advancing time', () => {
    const start = createInitialState(CONTENT);
    const stale = { ...start, rates: { ...start.rates, cyclesPerSec: 12345 } };
    const lifted = reachable(stale);
    expect(lifted.rates).toEqual(tick(stale, 1 / CONTENT.balance.tickHz, CONTENT).rates);
    expect(lifted.simTimeSec).toBe(stale.simTimeSec);
  });
});
