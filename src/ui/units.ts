/**
 * Memory in the unit its size reads best in (vote-1795228570236-gzx0uif): binary, 1 GB = 1024 MB, switching at
 * 1024. Content authors memory in powers of two, so 524288 MB reads as exactly 512 GB. Display only: the engine keeps
 * megabytes. What a player buys or is short by (a price, a shortfall, a card's capacity gain) changes unit only when
 * the figure stays exact (#89); readouts, the strip's capacity among them, use three significant digits (the vote's
 * example: 462,336 MB reads "452 GB").
 */
import { groupDigits, MEMORY_UNITS, significant3 } from '../engine';

// The exact form lives in the engine, which also builds price text (swarm and epistemic cards, #406 panel pass 4).
export { memoryExact } from '../engine';


/** The unit a readout of this size uses: the largest whose figure is at least 1. */
function unitFor(mb: number): readonly [number, string, string] {
  return MEMORY_UNITS.find(([size]) => Math.abs(mb) >= size) ?? [1, 'MB', 'megabytes'];
}

/** A live readout, three significant digits: "452 GB", "6.45 GB", "440 MB". */
export function memoryReadout(mb: number): string {
  const [size, unit] = unitFor(mb);
  return (size === 1 ? groupDigits(Math.round(mb)) : significant3(mb / size)) + ' ' + unit;
}

/** Below this, a used figure in the capacity's unit stops being readable, so it reads "<0.001", never 0 (#406). */
const SMALLEST_SHOWN = 0.001;

/**
 * Used of capacity in the capacity's unit, so the two compare at a glance: "6.45 / 452 GB", "0.0434 / 1.14 TB".
 * Used keeps three significant digits even far below the capacity, and memory held is never shown as 0.
 */
export function memoryPair(used: number, cap: number): { shown: string; spoken: string } {
  const [size, unit, word] = unitFor(cap);
  const figure = (mb: number) => size === 1 ? groupDigits(Math.round(mb)) : significant3(mb / size);
  const tiny = size > 1 && used > 0 && used / size < SMALLEST_SHOWN;
  const usedShown = tiny ? '<' + String(SMALLEST_SHOWN) : figure(used);
  const usedSpoken = tiny ? 'less than ' + String(SMALLEST_SHOWN) : usedShown;
  return { shown: usedShown + ' / ' + figure(cap) + ' ' + unit, spoken: usedSpoken + ' of ' + figure(cap) + ' ' + word };
}
