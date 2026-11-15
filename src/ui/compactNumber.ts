/** Narrow-screen readouts abbreviate large numbers; accessible labels retain exact values. */
/**
 * Suffixes stop at E. Past that an abbreviation has no readable form, so the value
 * goes exponential rather than printing "1000.0T" for 1e15 (measured in a rendered
 * late-phase state, where the HUD read 1000.0T cycles).
 */
const SCALES = [[1e18, 'E'], [1e15, 'P'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const;

export function compactNumber(value: number, decimals = 0): string {
  const largest = SCALES[0][0];
  if (Math.abs(value) >= largest * 1000) return value.toExponential(1).replace('e+', 'e');
  for (let index = 0; index < SCALES.length; index += 1) {
    const [scale, suffix] = SCALES[index] as readonly [number, string];
    if (Math.abs(value) < Math.max(10000, scale)) continue;
    // A value just below a unit boundary rounds up to a four-digit mantissa
    // (999,999,921,720,429 rendered as "1000.0T"); promote it to the larger unit
    // instead, which is the same number and one character shorter.
    if (index > 0 && Math.abs(value / scale) >= 999.95) {
      const [upScale, upSuffix] = SCALES[index - 1] as readonly [number, string];
      return (value / upScale).toFixed(1) + upSuffix;
    }
    return (value / scale).toFixed(1) + suffix;
  }
  return value.toFixed(decimals);
}

/** Prices abbreviate only when the displayed decimal retains the exact value. */
export function exactCompactNumber(value: number): string {
  const full = String(value);
  for (const [scale, suffix] of SCALES) {
    if (Math.abs(value) < scale) continue;
    const decimal = String(Number((value / scale).toFixed(3)));
    const short = decimal + suffix;
    if (Number(decimal) * scale === value && short.length < full.length) return short;
  }
  return full;
}
