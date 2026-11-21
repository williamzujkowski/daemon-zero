/** The voted unit scheme (vote-1795228570236-gzx0uif): K/M/B with three significant digits, binary memory units. */
import { describe, expect, it } from 'vitest';
import { compactAmount, groupDigits, significant3, spokenAmount } from '../src/engine';
import { memoryExact, memoryPair, memoryReadout } from '../src/ui/units';

describe('amounts', () => {
  it('keeps three significant digits with no trailing zeros', () => {
    expect(['1.25', '12.5', '125', '1', '10', '9.99'].map(Number).map(significant3)).toEqual(['1.25', '12.5', '125', '1', '10', '9.99']);
    expect(significant3(1.2)).toBe('1.2');
    expect(significant3(-45.5)).toBe('-45.5');
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

  it('groups digits losslessly', () => {
    expect(groupDigits(1_000_000)).toBe('1,000,000');
    expect(groupDigits(-1234)).toBe('-1,234');
  });
});

describe('memory', () => {
  it('turns exact powers of two into GB and TB and keeps a price exact', () => {
    expect(memoryExact(512)).toBe('512 MB');
    expect(memoryExact(1024)).toBe('1 GB');
    expect(memoryExact(1536)).toBe('1.5 GB');
    expect(memoryExact(524288)).toBe('512 GB');
    expect(memoryExact(1048576)).toBe('1 TB');
    // Not exact in GB at three digits: stays in grouped megabytes (#89's exact-price rule).
    expect(memoryExact(6608)).toBe('6,608 MB');
  });

  it('reads a live figure in three significant digits, and a pair in the capacity unit', () => {
    expect(memoryReadout(440)).toBe('440 MB');
    expect(memoryReadout(6608)).toBe('6.45 GB');
    expect(memoryPair(6608, 462336)).toEqual({ shown: '6.45 / 452 GB', spoken: '6.45 of 452 gigabytes' });
    expect(memoryPair(440, 3584)).toEqual({ shown: '0.43 / 3.5 GB', spoken: '0.43 of 3.5 gigabytes' });
    expect(memoryPair(152, 192)).toEqual({ shown: '152 / 192 MB', spoken: '152 of 192 megabytes' });
  });
});
