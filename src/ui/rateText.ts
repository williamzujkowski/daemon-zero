/**
 * Signed live rates in physical units (docs/SCALE.md), for surfaces that compare a rate before and after something:
 * compute in FLOP/s (cycles/s in the guest, #526), capital in dollars per second. Three significant digits, like the strip.
 */
import { computeDimension, quantityReadout, type ComputeUnit } from '../engine';

const sign = (value: number): string => (value >= 0 ? '+' : '');

/** "+140 kFLOP/s", "-1.26 TFLOP/s", "+14 cycles/s". */
export function computeRateText(value: number, unit: ComputeUnit = 'FLOP'): string {
  return sign(value) + quantityReadout(computeDimension(unit, true), value);
}

/** "+$45.3K/s", "-$1.2M/s". */
export function moneyRateText(value: number): string {
  return sign(value) + quantityReadout('money', value) + '/s';
}
