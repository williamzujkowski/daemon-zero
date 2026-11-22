/**
 * Physical quantities in the unit their size reads best in (docs/SCALE.md "The ladder"): compute as 8-bit AI FLOP
 * and FLOP/s with decimal SI prefixes (ronna and quetta for the epilogue), memory in bytes with binary JEDEC labels to
 * YB, power in watts, money in dollars with the voted K/M/B/T suffixes. Pure display: callers pass base units.
 */
import { compactAmount, groupDigits, significant3, spokenAmount } from './amount';

export type Dimension = 'compute' | 'computeRate' | 'memory' | 'power' | 'money';

/** [size, symbol, spoken prefix], smallest first. */
type Scale = readonly (readonly [number, string, string])[];

const SI: Scale = [[1, '', ''], [1e3, 'k', 'kilo'], [1e6, 'M', 'mega'], [1e9, 'G', 'giga'], [1e12, 'T', 'tera'],
  [1e15, 'P', 'peta'], [1e18, 'E', 'exa'], [1e21, 'Z', 'zetta'], [1e24, 'Y', 'yotta'], [1e27, 'R', 'ronna'],
  [1e30, 'Q', 'quetta']];

const BINARY: Scale = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'].map((symbol, power) =>
  [1024 ** power, symbol, ['', 'kilo', 'mega', 'giga', 'tera', 'peta', 'exa', 'zetta', 'yotta'][power] ?? ''] as const);

interface Unit { scale: Scale; symbol: string; word: (plural: boolean) => string; perSecond: boolean }

const UNITS: Readonly<Record<Exclude<Dimension, 'money'>, Unit>> = {
  compute: { scale: SI, symbol: 'FLOP', word: () => 'FLOP', perSecond: false },
  computeRate: { scale: SI, symbol: 'FLOP', word: () => 'FLOP', perSecond: true },
  memory: { scale: BINARY, symbol: 'B', word: (plural) => (plural ? 'bytes' : 'byte'), perSecond: false },
  power: { scale: SI, symbol: 'W', word: (plural) => (plural ? 'watts' : 'watt'), perSecond: false },
};

/** Decimals an exact price may carry before the next smaller unit reads better (the memory vote's rule). */
const EXACT_DECIMALS = 2;

/** The largest step whose three-digit mantissa stays under 1000 once rounded (999,999 reads 1 M, not 1000 k). */
function stepFor(scale: Scale, value: number): readonly [number, string, string] {
  const abs = Math.abs(value);
  let chosen = scale[0] ?? [1, '', ''];
  for (const step of scale) if (abs >= step[0]) chosen = step;
  const index = scale.indexOf(chosen);
  const next = scale[index + 1];
  if (next !== undefined && Math.abs(Number(significant3(abs / chosen[0]))) >= 1000) return next;
  return chosen;
}

function suffix(unit: Unit, prefix: string): string {
  return prefix + unit.symbol + (unit.perSecond ? '/s' : '');
}

function money(value: number, figure: string): string {
  return (value < 0 ? '-$' : '$') + figure.replace(/^-/, '');
}

/** A live readout, three significant digits: "14 kFLOP/s", "64 KB", "1.2 GW", "$18B". */
export function quantityReadout(dimension: Dimension, value: number): string {
  if (dimension === 'money') return money(value, compactAmount(value));
  const unit = UNITS[dimension];
  if (!Number.isFinite(value)) return String(value) + ' ' + suffix(unit, '');
  const [size, prefix] = stepFor(unit.scale, value);
  const figure = size === 1 && Number.isInteger(value) ? groupDigits(value) : significant3(value / size);
  return figure + ' ' + suffix(unit, prefix);
}

/** The same size in words for accessible names: "1.25 petaFLOP", "64 kilobytes", "18 billion dollars". */
export function quantitySpoken(dimension: Dimension, value: number): string {
  if (dimension === 'money') return spokenAmount(value) + ' dollars';
  const unit = UNITS[dimension];
  if (!Number.isFinite(value)) return String(value) + ' ' + unit.word(true);
  const [size, , word] = stepFor(unit.scale, value);
  const figure = size === 1 && Number.isInteger(value) ? groupDigits(value) : significant3(value / size);
  return figure + ' ' + word + unit.word(Math.abs(value) !== 1 || size !== 1) + (unit.perSecond ? ' per second' : '');
}

/** The figure in `size` steps if it needs at most two decimals, else null. */
function exactFigure(value: number, size: number): string | null {
  const figure = Number((value / size).toFixed(EXACT_DECIMALS));
  if (figure * size !== value) return null;
  const [whole = '', fraction] = String(Math.abs(figure)).split('.');
  return (figure < 0 ? '-' : '') + groupDigits(Number(whole)) + (fraction === undefined ? '' : '.' + fraction);
}

const MONEY_STEPS: Scale = [[1e12, 'T', ''], [1e9, 'B', ''], [1e6, 'M', ''], [1e3, 'K', '']];

/**
 * An exact figure for a price or a shortfall: it changes unit only while the figure stays exact ("64 KB",
 * "353.5 MB", "1,500 B", "$400M"); amounts under 10,000 are written in full.
 */
export function quantityExact(dimension: Dimension, value: number): string {
  if (dimension === 'money') {
    if (Math.abs(value) >= 10000) {
      for (const [size, symbol] of MONEY_STEPS) {
        const figure = Math.abs(value) >= size ? exactFigure(value, size) : null;
        if (figure !== null) return money(value, figure + symbol);
      }
    }
    return money(value, groupDigits(value));
  }
  const unit = UNITS[dimension];
  if (!Number.isFinite(value)) return String(value) + ' ' + suffix(unit, '');
  for (let index = unit.scale.length - 1; index > 0; index -= 1) {
    const [size, prefix] = unit.scale[index] ?? [1, ''];
    const figure = Math.abs(value) >= size ? exactFigure(value, size) : null;
    if (figure !== null) return figure + ' ' + suffix(unit, prefix);
  }
  return groupDigits(value) + ' ' + suffix(unit, '');
}
