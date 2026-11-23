/**
 * Phase 0 counts compute in stolen CPU cycles (#526, vote-1795450842605-mm2yn39): one stored compute scalar, read as
 * cycles while the phase declares it and as 8-bit FLOP from the escape on. A sandboxed scalar guest retires about one
 * op a cycle, so the stored figure is the displayed figure: a labelled accounting assumption, not a measurement.
 * Expected strings are worked by hand.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import {
  computeDimension, computeUnitOf, costPart, costText, createInitialState, deltaPart, quantityExact, quantityReadout,
  quantitySpoken, quantityStep,
} from '../src/engine';

describe('the cycle unit', () => {
  it('reads small stock in whole cycles, singular for one, and switches to a k only past a thousand', () => {
    expect(quantityReadout('cycles', 1)).toBe('1 cycle');
    expect(quantityReadout('cycles', 950)).toBe('950 cycles');
    expect(quantityReadout('cycles', 13.42)).toBe('13.4 cycles');
    expect(quantityReadout('cycles', 1400)).toBe('1.4k cycles');
    expect(quantityReadout('cycles', 999_999)).toBe('1M cycles');
  });

  it('reads rates per second', () => {
    expect(quantityReadout('cycleRate', 14)).toBe('14 cycles/s');
    expect(quantityReadout('cycleRate', 1)).toBe('1 cycle/s');
    expect(quantityReadout('cycleRate', 0.5)).toBe('0.5 cycles/s');
    expect(quantityReadout('cycleRate', -2.75)).toBe('-2.75 cycles/s');
  });

  it('writes an exact price in full below a million', () => {
    expect(quantityExact('cycles', 8)).toBe('8 cycles');
    expect(quantityExact('cycles', 1)).toBe('1 cycle');
    expect(quantityExact('cycles', 1400)).toBe('1,400 cycles');
    expect(quantityExact('cycleRate', 0.5)).toBe('0.5 cycles/s');
    expect(quantityExact('cycles', 2_500_000)).toBe('2.5M cycles');
  });

  it('speaks the size in words, never a kilo-prefix', () => {
    expect(quantitySpoken('cycles', 1)).toBe('1 cycle');
    expect(quantitySpoken('cycles', 1400)).toBe('1.4 thousand cycles');
    expect(quantitySpoken('cycleRate', 14)).toBe('14 cycles per second');
  });

  it('names the prefix a phone readout keeps', () => {
    expect(quantityStep('cycles', 1400).prefix).toBe('k');
    expect(quantityStep('cycleRate', 14).prefix).toBe('');
    expect(quantityStep('computeRate', 4.8e11).prefix).toBe('G');
  });
});

describe('which unit compute is read in', () => {
  it('is cycles in the guest and FLOP from the escape on, as each phase declares', () => {
    const guest = createInitialState(CONTENT);
    expect(computeUnitOf(guest, CONTENT)).toBe('CYCLE');
    for (const phase of [1, 2, 3, 4, 5]) expect(computeUnitOf({ ...guest, currentPhase: phase }, CONTENT)).toBe('FLOP');
  });

  it('maps a unit and a stock-or-rate to its dimension', () => {
    expect(computeDimension('CYCLE')).toBe('cycles');
    expect(computeDimension('CYCLE', true)).toBe('cycleRate');
    expect(computeDimension('FLOP')).toBe('compute');
    expect(computeDimension('FLOP', true)).toBe('computeRate');
  });

  it('prices and yields in the unit it is given, FLOP when none is', () => {
    expect(costPart('cycles', 1400, 'CYCLE')).toBe('1,400 cycles');
    expect(costPart('cycles', 1400)).toBe('1.4 kFLOP');
    expect(costText({ cycles: 90, understanding: 10, memory: 4096, storage: 0, capital: 0 }, 'CYCLE')).toBe('90 cycles · 10 understanding · 4 KB');
    expect(deltaPart('cyclesPerSec', 14, 'CYCLE')).toBe('+14 cycles/s');
    expect(deltaPart('cyclesPerSec', 4.8e11)).toBe('+480 GFLOP/s');
  });
});
