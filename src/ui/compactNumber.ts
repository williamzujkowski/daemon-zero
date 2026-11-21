/** Narrow-screen readouts abbreviate large numbers; accessible labels retain exact values. */
import { compactAmount, groupDigits } from '../engine';
const SCALES = [[1e18, 'E'], [1e15, 'P'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const;

/**
 * A live amount: three significant digits with K/M/B (vote-1795228570236-gzx0uif, via the engine's compactAmount);
 * under 10,000 it keeps `decimals` places, so a small rate still reads "+4.1".
 */
export function compactNumber(value: number, decimals = 0): string {
  return Math.abs(value) < 10000 ? value.toFixed(decimals) : compactAmount(value);
}

/** Prices abbreviate only when the displayed decimal retains the exact value. */
export function exactCompactNumber(value: number): string {
  // Grouped, not bare: a price that cannot abbreviate exactly read "1978135949" on a phone (#404).
  const full = groupDigits(value);
  for (const [scale, suffix] of SCALES) {
    if (Math.abs(value) < scale) continue;
    const decimal = String(Number((value / scale).toFixed(3)));
    const short = decimal + suffix;
    if (Number(decimal) * scale === value && short.length < full.length) return short;
  }
  return full;
}
