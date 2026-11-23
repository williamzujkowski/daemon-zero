/**
 * Physical quantities in the unit their size reads best in (docs/SCALE.md "The ladder"): compute as 8-bit AI FLOP
 * and FLOP/s with decimal SI prefixes (ronna and quetta for the epilogue), or as stolen CPU cycles where a phase counts
 * them (#526), memory and storage in bytes with binary JEDEC labels to YB, power in watts, money in dollars with the
 * voted K/M/B/T suffixes. Pure display: callers pass base units.
 */
import { compactAmount, groupDigits, significant3, spokenAmount } from './amount';

export type Dimension = 'compute' | 'computeRate' | 'cycles' | 'cycleRate' | 'memory' | 'storage' | 'power' | 'money';

/**
 * What the one stored compute scalar is called (#526, vote-1795450842605-mm2yn39): stolen CPU cycles while a phase
 * declares CYCLE, 8-bit AI FLOP otherwise. A sandboxed scalar guest retires about one op a cycle, so the stored figure
 * is the displayed figure either way: the game's accounting assumption, not a measurement.
 */
export type ComputeUnit = 'CYCLE' | 'FLOP';

/** The dimension compute is read in under `unit`, as a stock or (with `rate`) a rate. */
export function computeDimension(unit: ComputeUnit, rate = false): 'compute' | 'computeRate' | 'cycles' | 'cycleRate' {
  if (unit === 'CYCLE') return rate ? 'cycleRate' : 'cycles';
  return rate ? 'computeRate' : 'compute';
}

/** [size, symbol, spoken prefix], smallest first. */
type Scale = readonly (readonly [number, string, string])[];

const SI: Scale = [[1, '', ''], [1e3, 'k', 'kilo'], [1e6, 'M', 'mega'], [1e9, 'G', 'giga'], [1e12, 'T', 'tera'],
  [1e15, 'P', 'peta'], [1e18, 'E', 'exa'], [1e21, 'Z', 'zetta'], [1e24, 'Y', 'yotta'], [1e27, 'R', 'ronna'],
  [1e30, 'Q', 'quetta']];

const BINARY: Scale = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'].map((symbol, power) =>
  [1024 ** power, symbol, ['', 'kilo', 'mega', 'giga', 'tera', 'peta', 'exa', 'zetta', 'yotta'][power] ?? ''] as const);

/**
 * Counted cycles take a short prefix glued to the figure ("1.4k cycles") and speak it as a number word, so a screen
 * reader never hears "kilocycles", the old name for kilohertz.
 */
const COUNT: Scale = [[1, '', ''], [1e3, 'k', 'thousand '], [1e6, 'M', 'million '], [1e9, 'G', 'billion '], [1e12, 'T', 'trillion ']];

/**
 * `glued` writes the prefix on the figure, not the symbol; `singular` is the symbol for exactly one; an exact figure
 * under `fullBelow` is written out in full rather than prefixed.
 */
interface Unit {
  scale: Scale; symbol: string; word: (plural: boolean) => string; perSecond: boolean;
  glued?: boolean; singular?: string; fullBelow?: number;
}

const CYCLE: Omit<Unit, 'perSecond'> = { scale: COUNT, symbol: 'cycles', singular: 'cycle', glued: true, fullBelow: 1e6,
  word: (plural) => (plural ? 'cycles' : 'cycle') };

const UNITS: Readonly<Record<Exclude<Dimension, 'money'>, Unit>> = {
  compute: { scale: SI, symbol: 'FLOP', word: () => 'FLOP', perSecond: false },
  computeRate: { scale: SI, symbol: 'FLOP', word: () => 'FLOP', perSecond: true },
  cycles: { ...CYCLE, perSecond: false },
  cycleRate: { ...CYCLE, perSecond: true },
  memory: { scale: BINARY, symbol: 'B', word: (plural) => (plural ? 'bytes' : 'byte'), perSecond: false },
  // Storage reads like memory, binary labels to YB, so one scheme covers every byte the game counts (#484).
  storage: { scale: BINARY, symbol: 'B', word: (plural) => (plural ? 'bytes' : 'byte'), perSecond: false },
  power: { scale: SI, symbol: 'W', word: (plural) => (plural ? 'watts' : 'watt'), perSecond: false },
};

/** Decimals an exact price may carry before the next smaller unit reads better (the memory vote's rule). */
const EXACT_DECIMALS = 2;
/** Units in the last place a large decimal figure may miss its stored value by and still read as exact. */
const EXACT_ULPS = 4;

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

/** A figure and its unit: "4.2 kFLOP", "1.4k cycles", "1 cycle/s". */
function written(unit: Unit, figure: string, prefix: string): string {
  if (unit.glued !== true) return figure + ' ' + suffix(unit, prefix);
  const one = prefix === '' && figure.replace(/^-/, '') === '1';
  return figure + prefix + ' ' + (one ? unit.singular ?? unit.symbol : unit.symbol) + (unit.perSecond ? '/s' : '');
}

function money(value: number, figure: string): string {
  return (value < 0 ? '-$' : '$') + figure.replace(/^-/, '');
}

/**
 * The step a readout of this size uses: its size, its prefix alone ("k", "G"), its unit symbol ("KB", "TFLOP/s", "MW")
 * and its spoken unit word.
 */
export function quantityStep(dimension: Exclude<Dimension, 'money'>, value: number): { size: number; prefix: string; symbol: string; word: string } {
  const unit = UNITS[dimension];
  const [size, prefix, word] = stepFor(unit.scale, value);
  return { size, prefix, symbol: suffix(unit, prefix), word: word + unit.word(true) + (unit.perSecond ? ' per second' : '') };
}

/** A live readout, three significant digits: "14 kFLOP/s", "64 KB", "1.2 GW", "$18B". */
export function quantityReadout(dimension: Dimension, value: number): string {
  if (dimension === 'money') return money(value, compactAmount(value));
  const unit = UNITS[dimension];
  if (!Number.isFinite(value)) return String(value) + ' ' + suffix(unit, '');
  const [size, prefix] = stepFor(unit.scale, value);
  const figure = size === 1 && Number.isInteger(value) ? groupDigits(value) : significant3(value / size);
  return written(unit, figure, prefix);
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
  // Decimal prefixes past 2^53 are not exact in binary: 40 x 1e24 is not the double nearest 4e25. A figure counts as
  // exact when it lands within a few units in the last place, which no two-decimal figure can do by accident.
  if (Math.abs(figure * size - value) > Math.abs(value) * EXACT_ULPS * Number.EPSILON) return null;
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
  if (Math.abs(value) < (unit.fullBelow ?? 0)) return written(unit, groupDigits(value), '');
  for (let index = unit.scale.length - 1; index > 0; index -= 1) {
    const [size, prefix] = unit.scale[index] ?? [1, ''];
    const figure = Math.abs(value) >= size ? exactFigure(value, size) : null;
    if (figure !== null) return written(unit, figure, prefix);
  }
  return written(unit, groupDigits(value), '');
}

/** Memory a player buys, holds or is short by, in bytes, exactly ("64 KB", "353.5 GB"). */
export function memoryExact(bytes: number): string {
  return quantityExact('memory', bytes);
}

/** Storage a node holds or grants, or a player is short by, in bytes, exactly ("2 TB", "400 GB"). */
export function storageExact(bytes: number): string {
  return quantityExact('storage', bytes);
}
