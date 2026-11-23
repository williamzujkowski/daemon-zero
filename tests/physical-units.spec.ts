/**
 * Physical units for the scale overhaul (docs/SCALE.md, vote-1795367506116-49pi7gt, amended by
 * vote-1795367697930-zzlgr4n): compute in 8-bit AI FLOP (decimal SI, epilogue up to quetta), memory in bytes (binary
 * JEDEC labels to YB), power in watts (decimal SI) and money in dollars. Expected strings are worked by hand.
 */
import { describe, expect, it } from 'vitest';
import { quantityExact, quantityReadout, quantitySpoken } from '../src/engine';

describe('compute', () => {
  it('reads stored work in FLOP with SI prefixes and three significant digits', () => {
    expect(quantityReadout('compute', 950)).toBe('950 FLOP');
    expect(quantityReadout('compute', 4200)).toBe('4.2 kFLOP');
    expect(quantityReadout('compute', 1.25e15)).toBe('1.25 PFLOP');
    expect(quantityReadout('compute', 3.4e24)).toBe('3.4 YFLOP');
  });

  it('reads a rate per second, and promotes a mantissa that would round to 1000', () => {
    expect(quantityReadout('computeRate', 14_000)).toBe('14 kFLOP/s');
    expect(quantityReadout('computeRate', 999_999)).toBe('1 MFLOP/s');
    expect(quantityReadout('computeRate', 2e21)).toBe('2 ZFLOP/s');
    expect(quantityReadout('computeRate', -26_203_469)).toBe('-26.2 MFLOP/s');
  });

  it('keeps the epilogue prefixes ronna and quetta', () => {
    expect(quantityReadout('compute', 6e27)).toBe('6 RFLOP');
    expect(quantityReadout('computeRate', 1.5e31)).toBe('15 QFLOP/s');
  });

  it('speaks the prefix in words', () => {
    expect(quantitySpoken('compute', 1.25e15)).toBe('1.25 petaFLOP');
    expect(quantitySpoken('computeRate', 14_000)).toBe('14 kiloFLOP per second');
  });
});

describe('memory', () => {
  it('starts in bytes and steps by 1024 with JEDEC labels', () => {
    expect(quantityReadout('memory', 512)).toBe('512 B');
    expect(quantityReadout('memory', 65_536)).toBe('64 KB');
    expect(quantityReadout('memory', 1536)).toBe('1.5 KB');
    expect(quantityReadout('memory', 1024 ** 3 * 80)).toBe('80 GB');
    expect(quantityReadout('memory', 1024 ** 7 * 13)).toBe('13 ZB');
    expect(quantityReadout('memory', 1024 ** 8 * 2)).toBe('2 YB');
  });

  it('speaks bytes in words', () => {
    expect(quantitySpoken('memory', 65_536)).toBe('64 kilobytes');
    expect(quantitySpoken('memory', 1)).toBe('1 byte');
    expect(quantitySpoken('memory', 512)).toBe('512 bytes');
  });
});

describe('power and money', () => {
  it('reads watts with decimal SI up to the Sun', () => {
    expect(quantityReadout('power', 500)).toBe('500 W');
    expect(quantityReadout('power', 14_300)).toBe('14.3 kW');
    expect(quantityReadout('power', 1.2e9)).toBe('1.2 GW');
    expect(quantityReadout('power', 3.5e12)).toBe('3.5 TW');
    expect(quantityReadout('power', 3.828e26)).toBe('383 YW');
    expect(quantitySpoken('power', 1.2e9)).toBe('1.2 gigawatts');
  });

  it('reads dollars with the voted K/M/B/T suffixes and a dollar sign', () => {
    expect(quantityReadout('money', 9999)).toBe('$9,999');
    expect(quantityReadout('money', 18e9)).toBe('$18B');
    expect(quantityReadout('money', 1.1e14)).toBe('$110T');
    expect(quantityReadout('money', -26_203_469)).toBe('-$26.2M');
    expect(quantitySpoken('money', 18e9)).toBe('18 billion dollars');
  });
});

describe('exact figures for prices', () => {
  it('changes unit only when the figure stays exact', () => {
    expect(quantityExact('memory', 65_536)).toBe('64 KB');
    expect(quantityExact('memory', 1024 * 1024 * 353.5)).toBe('353.5 MB');
    // 1,500 bytes is not a short exact KB figure (1.46484375), so it stays in bytes.
    expect(quantityExact('memory', 1500)).toBe('1,500 B');
    expect(quantityExact('compute', 8e15)).toBe('8 PFLOP');
    // 1,234.567 kFLOP needs three decimals, so the figure stays whole in FLOP.
    expect(quantityExact('compute', 1_234_567)).toBe('1,234,567 FLOP');
    expect(quantityExact('compute', 1_250_000)).toBe('1.25 MFLOP');
    expect(quantityExact('money', 12_345)).toBe('$12,345');
    expect(quantityExact('power', 300e6)).toBe('300 MW');
    expect(quantityExact('money', 400_000_000)).toBe('$400M');
    expect(quantityExact('money', 6_000)).toBe('$6,000');
  });

  it('leaves zero and non-finite values readable', () => {
    expect(quantityReadout('memory', 0)).toBe('0 B');
    expect(quantityReadout('computeRate', 0)).toBe('0 FLOP/s');
    expect(quantityReadout('power', Number.NaN)).toBe('NaN W');
    expect(quantityExact('money', 0)).toBe('$0');
  });
});

describe('exact figures past 2^53', () => {
  it('keeps a decimal prefix exact where binary floating point cannot represent the product', () => {
    expect(quantityExact('compute', 4e25)).toBe('40 YFLOP');
    expect(quantityExact('compute', 2.2e18)).toBe('2.2 EFLOP');
    expect(quantityExact('computeRate', 8.3e18)).toBe('8.3 EFLOP/s');
  });

  it('still steps down when the figure needs more than two decimals', () => {
    expect(quantityExact('compute', 1.2345e18)).toBe('1,234.5 PFLOP');
  });
});
