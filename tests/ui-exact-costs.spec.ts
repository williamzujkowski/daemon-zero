/** Price abbreviations must never round a purchase or conceal a near-affordable shortfall. */
import { describe, expect, it } from 'vitest';
import { exactCompactNumber } from '../src/ui/compactNumber';
import { costText, groupDigits } from '../src/ui/format';

describe('lossless price labels', () => {
  it.each([[15000000, '15M'], [1250000, '1.25M'], [1000000000, '1B'], [16384, '16384'],
    [15000001, '15000001'], [9999, '9999'], [0.125, '0.125'], [10050, '10050'], [0, '0']])('formats %s as %s without approximation', (value, expected) => {
    expect(exactCompactNumber(value)).toBe(expected);
  });
  it('retains resource units and exact noncompressible components', () => {
    const cost = { cycles: 15000000, understanding: 15000001, memory: 16384, capital: 1250000 };
    expect(costText(cost, true)).toBe('15M cycles · 15000001 understanding · 16384 MB · 1.25M capital');
    // Grouping is presentational: the digits are unchanged, so a purchase a player
    // cannot yet afford is still visibly short by exactly one unit.
    expect(costText(cost)).toBe('15,000,000 cycles · 15,000,001 understanding · 16,384 MB · 1,250,000 capital');
    expect(costText({ cycles: 0, understanding: 0, memory: 0, capital: 0 }, true)).toBe('Free');
  });
  it('groups thousands without rounding, sign or locale', () => {
    expect(groupDigits(0)).toBe('0');
    expect(groupDigits(999)).toBe('999');
    expect(groupDigits(1000)).toBe('1,000');
    expect(groupDigits(1000000000)).toBe('1,000,000,000');
    expect(groupDigits(-1500000)).toBe('-1,500,000');
    expect(groupDigits(0.125)).toBe('0.125');
  });
});
