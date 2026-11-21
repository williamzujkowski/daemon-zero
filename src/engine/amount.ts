/**
 * Display forms of a large amount, shared by the UI and by the engine's own log text (the boot log stores its
 * numbers in saved entries, #380). Pure: no locale data, no clock. vote-1795228570236-gzx0uif: K/M/B suffixes with
 * three significant digits and no trailing ".0"; amounts under 10,000 are grouped in full.
 */
const SCALES = [[1e18, 'E', 'quintillion'], [1e15, 'P', 'quadrillion'], [1e12, 'T', 'trillion'], [1e9, 'B', 'billion'],
  [1e6, 'M', 'million'], [1e3, 'K', 'thousand']] as const;

/** Thousands separators without rounding: 1000000 -> "1,000,000". Non-integers are returned as written. */
export function groupDigits(value: number): string {
  if (!Number.isInteger(value)) return String(value);
  const digits = String(Math.abs(value));
  let grouped = '';
  for (let end = digits.length; end > 0; end -= 3) {
    const start = Math.max(0, end - 3);
    grouped = grouped === '' ? digits.slice(start, end) : digits.slice(start, end) + ',' + grouped;
  }
  return (value < 0 ? '-' : '') + grouped;
}

/** Three significant digits, trailing zeros dropped: 1.25, 12.5, 125, 1. */
export function significant3(value: number): string {
  const abs = Math.abs(value);
  const text = abs >= 100 ? String(Math.round(abs)) : abs >= 10 ? abs.toFixed(1) : abs.toFixed(2);
  const trimmed = text.includes('.') ? text.replace(/\.?0+$/, '') : text;
  return (value < 0 ? '-' : '') + trimmed;
}

interface Scaled { mantissa: string; suffix: string; word: string }

/** The largest scale whose three-digit mantissa stays under 1000 (999,999 reads "1M", not "1000K"). */
function scaled(value: number): Scaled | null {
  const abs = Math.abs(value);
  if (abs < 10000) return null;
  for (let index = SCALES.length - 1; index >= 0; index -= 1) {
    const [scale, suffix, word] = SCALES[index] as readonly [number, string, string];
    const next = SCALES[index - 1];
    if (next !== undefined && abs >= next[0]) continue;
    const mantissa = significant3(value / scale);
    if (Math.abs(Number(mantissa)) >= 1000 && next !== undefined) return { mantissa: significant3(value / next[0]), suffix: next[1], word: next[2] };
    return { mantissa, suffix, word };
  }
  return null;
}

/** "1.25B", "45.5K"; under 10,000 grouped in full ("9,999"); past the largest suffix, exponential. */
export function compactAmount(value: number): string {
  if (Math.abs(value) >= 1e21) return value.toExponential(2).replace('e+', 'e');
  const short = scaled(value);
  return short ? short.mantissa + short.suffix : groupDigits(Math.round(value));
}

/** The same size in words, for accessible names of live readouts: "1.25 billion"; under 10,000 grouped in full. */
export function spokenAmount(value: number): string {
  if (Math.abs(value) >= 1e21) return value.toExponential(2);
  const short = scaled(value);
  return short ? short.mantissa + ' ' + short.word : groupDigits(Math.round(value));
}
