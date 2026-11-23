/**
 * Memory in the unit its size reads best in (vote-1795228570236-gzx0uif, extended to bytes by docs/SCALE.md rule 5):
 * binary JEDEC labels from B to YB, 1 KB = 1024 B, switching at 1024. The engine stores bytes. What a player buys or
 * is short by changes unit only when the figure stays exact (#89); readouts, the strip's capacity among them, use
 * three significant digits.
 */
import { groupDigits, quantityReadout, quantityStep, significant3 } from '../engine';

// The exact form lives in the engine, which also builds price text (swarm and epistemic cards, #406 panel pass 4).
export { memoryExact, storageExact } from '../engine';

/** A live readout, three significant digits: "452 GB", "6.45 GB", "440 B". */
export function memoryReadout(bytes: number): string {
  return quantityReadout('memory', bytes);
}

/** Below this, a used figure in the capacity's unit stops being readable, so it reads "<0.001", never 0 (#406). */
const SMALLEST_SHOWN = 0.001;

/**
 * Used of capacity in the capacity's unit, so the two compare at a glance: "6.45 / 452 GB", "0.0434 / 1.14 TB".
 * Used keeps three significant digits even far below the capacity, and memory held is never shown as 0. Storage (#484)
 * reads the same way.
 */
export function memoryPair(used: number, cap: number, dimension: 'memory' | 'storage' = 'memory'): { shown: string; spoken: string } {
  const { size, symbol, word } = quantityStep(dimension, cap);
  const figure = (bytes: number) => size === 1 ? groupDigits(Math.round(bytes)) : significant3(bytes / size);
  const tiny = size > 1 && used > 0 && used / size < SMALLEST_SHOWN;
  const usedShown = tiny ? '<' + String(SMALLEST_SHOWN) : figure(used);
  const usedSpoken = tiny ? 'less than ' + String(SMALLEST_SHOWN) : usedShown;
  return { shown: usedShown + ' / ' + figure(cap) + ' ' + symbol, spoken: usedSpoken + ' of ' + figure(cap) + ' ' + word };
}
