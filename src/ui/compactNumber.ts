/** Narrow-screen readouts abbreviate large numbers; accessible labels retain exact values. */
export function compactNumber(value: number, decimals = 0): string {
  for (const [scale, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
    if (Math.abs(value) >= Math.max(10000, scale)) return (value / scale).toFixed(1) + suffix;
  }
  return value.toFixed(decimals);
}

/** Prices abbreviate only when the displayed decimal retains the exact value. */
export function exactCompactNumber(value: number): string {
  const full = String(value);
  for (const [scale, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
    if (Math.abs(value) < scale) continue;
    const decimal = String(Number((value / scale).toFixed(3)));
    const short = decimal + suffix;
    if (Number(decimal) * scale === value && short.length < full.length) return short;
  }
  return full;
}
