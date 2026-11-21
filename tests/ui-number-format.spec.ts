// @vitest-environment happy-dom
/**
 * Readout formatting (#108): the HUD is scanned, not read digit by digit.
 *
 * Two real screens exposed the gaps these pin: a mid-game desktop render printed
 * `1000000000` ungrouped, and a late-phase phone render printed `1000.0T` for 1e15.
 */
import { describe, expect, it } from 'vitest';
import { compactNumber } from '../src/ui/compactNumber';
import { groupDigits } from '../src/ui/format';

describe('HUD number formatting', () => {
  it.each([
    // vote-1795228570236-gzx0uif: three significant digits, no trailing ".0".
    [0, '0'], [999, '999'], [9999, '9999'], [10000, '10K'], [88000, '88K'],
    [1250000, '1.25M'], [1000000000, '1B'], [1e12, '1T'], [1e15, '1P'], [1e18, '1E'],
  ])('abbreviates %s as %s once it stops being scannable', (value, expected) => {
    expect(compactNumber(value)).toBe(expected);
  });

  it('never prints a four-digit mantissa with a suffix', () => {
    for (const value of [1.5e15, 9.99e18, 1e21, 999999921720429, 999999]) {
      expect(compactNumber(value), String(value)).not.toMatch(/^\d{4}/);
    }
  });

  it('promotes a value that rounds up across a unit boundary', () => {
    // A rendered insolvency state showed 999,999,921,720,429 as "1000.0T": correct
    // arithmetic, unreadable readout. It is 1P.
    expect(compactNumber(999999921720429)).toBe('1P');
    expect(compactNumber(999999)).toBe('1M');
    // At three significant digits 999,949 also rounds to 1000K, so it promotes too.
    expect(compactNumber(999949)).toBe('1M');
    expect(compactNumber(998499)).toBe('998K');
  });

  it('keeps a rate to the decimals the caller asks for', () => {
    expect(compactNumber(465400, 2)).toBe('465K');
    expect(compactNumber(0.125, 2)).toBe('0.13');
  });

  it('groups thousands of an exact amount without rounding it', () => {
    expect(groupDigits(1000000000)).toBe('1,000,000,000');
    expect(groupDigits(8192)).toBe('8,192');
    expect(groupDigits(999)).toBe('999');
  });
});
