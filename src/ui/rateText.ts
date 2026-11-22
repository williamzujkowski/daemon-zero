/**
 * Signed live rates in physical units (docs/SCALE.md), for surfaces that compare a rate before and after something:
 * compute in FLOP/s, capital in dollars per second. Three significant digits, like the strip.
 */
import { quantityReadout } from '../engine';

const sign = (value: number): string => (value >= 0 ? '+' : '');

/** "+140 kFLOP/s", "-1.26 TFLOP/s". */
export function computeRateText(value: number): string {
  return sign(value) + quantityReadout('computeRate', value);
}

/** "+$45.3K/s", "-$1.2M/s". */
export function moneyRateText(value: number): string {
  return sign(value) + quantityReadout('money', value) + '/s';
}
