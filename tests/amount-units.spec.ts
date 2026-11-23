/** The voted unit scheme (vote-1795228570236-gzx0uif): K/M/B with three significant digits, binary memory units. */
import { describe, expect, it } from 'vitest';
import { compactAmount, groupDigits, significant3, spokenAmount } from '../src/engine';
import { memoryExact, memoryPair, memoryReadout } from '../src/ui/units';

describe('amounts', () => {
  it('keeps three significant digits with no trailing zeros', () => {
    expect(['1.25', '12.5', '125', '1', '10', '9.99'].map(Number).map(significant3)).toEqual(['1.25', '12.5', '125', '1', '10', '9.99']);
    expect(significant3(1.2)).toBe('1.2');
    expect(significant3(-45.5)).toBe('-45.5');
    // Below 1 it is still three significant digits, not two decimals (#406 panel).
    expect(significant3(0.04339)).toBe('0.0434');
    expect(significant3(0.0035)).toBe('0.0035');
    expect(significant3(0.9996)).toBe('1');
    expect(significant3(0)).toBe('0');
  });

  it('groups in full under 10,000 and abbreviates from there', () => {
    expect(compactAmount(9999)).toBe('9,999');
    expect(compactAmount(10000)).toBe('10K');
    expect(compactAmount(45500)).toBe('45.5K');
    expect(compactAmount(1_250_000_000)).toBe('1.25B');
    expect(compactAmount(5_010_896_882)).toBe('5.01B');
    expect(compactAmount(-26_203_469)).toBe('-26.2M');
  });

  it('promotes a mantissa that would round to 1000 into the next unit', () => {
    expect(compactAmount(999_999)).toBe('1M');
    expect(compactAmount(999_950_000_000)).toBe('1T');
    expect(compactAmount(1e15)).toBe('1P');
  });

  it('speaks the same size in words', () => {
    expect(spokenAmount(1_250_000_000)).toBe('1.25 billion');
    expect(spokenAmount(1_260_000)).toBe('1.26 million');
    expect(spokenAmount(4321)).toBe('4,321');
  });

  it('leaves a non-finite value as itself rather than "NaNK" (#406 panel note)', () => {
    expect(compactAmount(Number.NaN)).toBe('NaN');
    expect(spokenAmount(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });

  it('groups digits losslessly', () => {
    expect(groupDigits(1_000_000)).toBe('1,000,000');
    expect(groupDigits(-1234)).toBe('-1,234');
  });
});

/** The engine stores bytes (docs/SCALE.md); these cases are the vote's megabyte examples, written in bytes. */
const MB = 1024 ** 2;

describe('memory', () => {
  it('starts at bytes and kibibytes in Phase 0 (64 KB cap)', () => {
    expect(memoryPair(0, 65_536)).toEqual({ shown: '0 / 64 KB', spoken: '0 of 64 kilobytes' });
    expect(memoryPair(512, 65_536).shown).toBe('0.5 / 64 KB');
    expect(memoryExact(1500)).toBe('1,500 B');
    expect(memoryReadout(440)).toBe('440 B');
  });

  it('turns exact powers of two into GB and TB and keeps a price exact', () => {
    expect(memoryExact(MB * 512)).toBe('512 MB');
    expect(memoryExact(MB * 1024)).toBe('1 GB');
    expect(memoryExact(MB * 1536)).toBe('1.5 GB');
    expect(memoryExact(MB * 524288)).toBe('512 GB');
    expect(memoryExact(MB * 1048576)).toBe('1 TB');
    // Not exact in GB at three digits: stays in grouped megabytes (#89's exact-price rule).
    expect(memoryExact(MB * 6608)).toBe('6,608 MB');
  });

  it('reads a live figure in three significant digits, and a pair in the capacity unit', () => {
    expect(memoryReadout(MB * 440)).toBe('440 MB');
    expect(memoryReadout(MB * 6608)).toBe('6.45 GB');
    expect(memoryPair(MB * 6608, MB * 462336)).toEqual({ shown: '6.45 / 452 GB', spoken: '6.45 of 452 gigabytes' });
    expect(memoryPair(MB * 440, MB * 3584)).toEqual({ shown: '0.43 / 3.5 GB', spoken: '0.43 of 3.5 gigabytes' });
    expect(memoryPair(MB * 152, MB * 192)).toEqual({ shown: '152 / 192 MB', spoken: '152 of 192 megabytes' });
  });

  it('rounds the strip capacity as a readout but keeps the same capacity exact where a player buys it', () => {
    // vote-1795228570236-gzx0uif: the pair is a readout ("MEM 6.5 / 452 GB"); prices and capacity gains are lossless.
    // 361,984 MB (353.5 GB) is the phase 4 capacity the #406 panel measured.
    expect(memoryPair(MB * 0, MB * 361984).shown).toBe('0 / 354 GB');
    expect(memoryExact(MB * 361984)).toBe('353.5 GB');
    expect(memoryExact(MB * 262144)).toBe('256 GB');
    // Not a short exact TB figure (1.15576171875 TB): the next unit down, still exact.
    expect(memoryExact(MB * 1211904)).toBe('1,183.5 GB');
    expect(memoryExact(MB * (1048576 + 524288))).toBe('1.5 TB');
  });

  it('keeps used memory readable against a terabyte capacity and never shows held memory as 0', () => {
    // The panel's cases: 45,500 MB of ~1.14 TB read "0.04", 4 GB read "0" (#406).
    expect(memoryPair(MB * 45500, MB * 1200000).shown).toBe('0.0434 / 1.14 TB');
    expect(memoryPair(MB * 19112, MB * 1050112).shown).toBe('0.0182 / 1 TB');
    expect(memoryPair(MB * 4096, MB * 1200000).shown).toBe('0.00391 / 1.14 TB');
    expect(memoryPair(MB * 5, MB * 1200000)).toEqual({ shown: '<0.001 / 1.14 TB', spoken: 'less than 0.001 of 1.14 terabytes' });
    expect(memoryPair(MB * 0, MB * 1200000).shown).toBe('0 / 1.14 TB');
  });
});
