/**
 * Display forms of a large amount, shared by the UI and by the engine's own log text (the boot log stores its
 * numbers in saved entries, #380). Pure: no locale data, no clock. vote-1795228570236-gzx0uif: K/M/B suffixes with
 * three significant digits and no trailing ".0"; amounts under 10,000 are grouped in full.
 */
/** Amount scales, largest first: one table for the engine and the UI (#406 panel note). */
export const AMOUNT_SCALES = [[1e18, 'E', 'quintillion'], [1e15, 'P', 'quadrillion'], [1e12, 'T', 'trillion'], [1e9, 'B', 'billion'],
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

/** Three significant digits, trailing zeros dropped: 1.25, 12.5, 125, 1, and below 1 still three (0.0434, not 0.04). */
export function significant3(value: number): string {
  const abs = Math.abs(value);
  const text = abs >= 100 ? String(Math.round(abs)) : abs >= 10 ? abs.toFixed(1) : abs >= 1 ? abs.toFixed(2)
    : String(Number(abs.toPrecision(3)));
  const trimmed = text.includes('.') ? text.replace(/\.?0+$/, '') : text;
  return (value < 0 ? '-' : '') + trimmed;
}

interface Scaled { mantissa: string; suffix: string; word: string }

/** The largest scale whose three-digit mantissa stays under 1000 (999,999 reads "1M", not "1000K"). */
function scaled(value: number): Scaled | null {
  const abs = Math.abs(value);
  if (abs < 10000) return null;
  for (let index = AMOUNT_SCALES.length - 1; index >= 0; index -= 1) {
    const [scale, suffix, word] = AMOUNT_SCALES[index] as readonly [number, string, string];
    const next = AMOUNT_SCALES[index - 1];
    if (next !== undefined && abs >= next[0]) continue;
    const mantissa = significant3(value / scale);
    if (Math.abs(Number(mantissa)) >= 1000 && next !== undefined) return { mantissa: significant3(value / next[0]), suffix: next[1], word: next[2] };
    return { mantissa, suffix, word };
  }
  return null;
}

/** "1.25B", "45.5K"; under 10,000 grouped in full ("9,999"); past the largest suffix, exponential. */
export function compactAmount(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1e21) return value.toExponential(2).replace('e+', 'e');
  const short = scaled(value);
  return short ? short.mantissa + short.suffix : groupDigits(Math.round(value));
}

/** The same size in words, for accessible names of live readouts: "1.25 billion"; under 10,000 grouped in full. */
export function spokenAmount(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1e21) return value.toExponential(2);
  const short = scaled(value);
  return short ? short.mantissa + ' ' + short.word : groupDigits(Math.round(value));
}

/** Binary memory units, largest first, with their spoken words; the engine keeps megabytes. */
export const MEMORY_UNITS = [[1024 * 1024, 'TB', 'terabytes'], [1024, 'GB', 'gigabytes']] as const;

/** Decimals an exact figure may carry before the next smaller unit reads better: 353.5 GB, but not 1.15576171875 TB. */
const EXACT_DECIMALS = 2;

/**
 * An exact figure for what a player buys or is short by: "512 GB", "353.5 GB", "1,183.5 GB" (1,211,904 MB is not a
 * short exact TB figure, so the next unit down), "6,608 MB". The vote: if three digits would round, print enough
 * decimals to be exact.
 */
export function memoryExact(mb: number): string {
  for (const [size, unit] of MEMORY_UNITS) {
    if (Math.abs(mb) < size) continue;
    const figure = Number((mb / size).toFixed(EXACT_DECIMALS));
    if (figure * size !== mb) continue;
    const [whole = '', fraction] = String(Math.abs(figure)).split('.');
    return (figure < 0 ? '-' : '') + groupDigits(Number(whole)) + (fraction === undefined ? '' : '.' + fraction) + ' ' + unit;
  }
  return groupDigits(mb) + ' MB';
}

/** An authored amount or rate: large ones in K/M/B ("650K"), small ones exactly as authored ("0.02", "15"). */
export function amountFigure(value: number): string {
  return Math.abs(value) >= 10000 ? compactAmount(value) : String(value);
}
