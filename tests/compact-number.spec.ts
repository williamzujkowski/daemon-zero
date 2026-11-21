import { expect, it } from 'vitest';
import { compactNumber } from '../src/ui/compactNumber';

it('keeps small rates precise and abbreviates large signed balances at readable scales', () => {
  expect(compactNumber(0)).toBe('0');
  expect(compactNumber(-0.05, 2)).toBe('-0.05');
  expect(compactNumber(9999)).toBe('9999');
  expect(compactNumber(10000)).toBe('10K');
  expect(compactNumber(-24000, 2)).toBe('-24K');
  expect(compactNumber(1500000)).toBe('1.5M');
  expect(compactNumber(2500000000)).toBe('2.5B');
  expect(compactNumber(3000000000000)).toBe('3T');
  expect(compactNumber(1262415.37, 2)).toBe('1.26M');
});
