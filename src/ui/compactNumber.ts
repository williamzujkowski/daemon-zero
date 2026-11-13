/** Narrow-screen readouts abbreviate large numbers; accessible labels retain exact values. */
export function compactNumber(value: number, decimals = 0): string {
  for (const [scale, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
    if (Math.abs(value) >= Math.max(10000, scale)) return (value / scale).toFixed(1) + suffix;
  }
  return value.toFixed(decimals);
}
