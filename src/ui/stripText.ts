/**
 * What each resource readout in the strip says and speaks, in physical units (docs/SCALE.md, vote-1795228570236-gzx0uif):
 * compute in FLOP and FLOP/s, or in stolen cycles while the phase counts them (#526), capital in dollars, understanding
 * as a plain count. Pure, so the strings the 360 px strip must fit are tested without mounting the screen.
 */
import { computeDimension, groupDigits, quantityReadout, quantitySpoken, quantityStep, significant3, spokenAmount, type ComputeUnit } from '../engine';
import { compactNumber } from './compactNumber';
import { computeRateText, moneyRateText } from './rateText';

export type StripResource = 'cycles' | 'understanding' | 'capital';

/** The desktop label and the name a screen reader hears before the value. */
export const STRIP_LABEL: Readonly<Record<StripResource, { label: string; name: string }>> = {
  cycles: { label: 'COMPUTE', name: 'compute' },
  understanding: { label: 'UNDERSTANDING', name: 'understanding' },
  capital: { label: 'CAPITAL', name: 'capital' },
};

/**
 * Phone-width labels. At 360 px a readout has about 133 px beside a three-letter label, 15 characters of 14 px
 * monospace. "14 kFLOP +140 kFLOP/s" cannot fit that, so on a phone the compute label carries the unit and the value
 * keeps only the SI prefix ("FLOP 14k +140k/s"); the accessible name keeps the full unit.
 */
export const STRIP_SHORT: Readonly<Record<string, string>> = {
  cycles: 'FLOP', understanding: 'UND', capital: 'CAP', memory: 'MEM', thermal: 'THM', suspicion: 'SUS',
};

/** The phone label: compute's names its unit, "CYC" while the guest counts stolen cycles (#526), "FLOP" after. */
export function stripShortLabel(resource: string, unit: ComputeUnit = 'FLOP'): string | undefined {
  return resource === 'cycles' && unit === 'CYCLE' ? 'CYC' : STRIP_SHORT[resource];
}

const sign = (value: number): string => (value >= 0 ? '+' : '');

/** A compute figure with its prefix and no unit, for the phone strip whose label names the unit: "14k", "1.25Y". */
export function computePrefixed(value: number, rate = false, unit: ComputeUnit = 'FLOP'): string {
  const { size, prefix } = quantityStep(computeDimension(unit, rate), value);
  const figure = size === 1 && Number.isInteger(value) ? groupDigits(value) : significant3(value / size);
  return figure + prefix;
}

function shownAmount(resource: StripResource, amount: number, short: boolean, unit: ComputeUnit): string {
  if (resource === 'cycles') return short ? computePrefixed(amount, false, unit) : quantityReadout(computeDimension(unit), amount);
  if (resource === 'capital') return quantityReadout('money', amount);
  return Math.abs(amount) >= 10000 ? compactNumber(amount) : groupDigits(amount);
}

function shownRate(resource: StripResource, rate: number, short: boolean, unit: ComputeUnit): string {
  if (resource === 'cycles') return short ? sign(rate) + computePrefixed(rate, true, unit) + '/s' : computeRateText(rate, unit);
  if (resource === 'capital') return moneyRateText(rate);
  return sign(rate) + compactNumber(rate, short ? 1 : 2) + '/s';
}

function spoken(resource: StripResource, value: number, rate: boolean, unit: ComputeUnit): string {
  if (resource === 'cycles') return quantitySpoken(computeDimension(unit, rate), value);
  if (resource === 'capital') return quantitySpoken('money', value) + (rate ? ' per second' : '');
  if (!rate) return spokenAmount(value);
  return (value < 10000 ? value.toFixed(2) : spokenAmount(value)) + ' per second';
}

/**
 * The readout's visible text and its accessible name. Phone width keeps the value and the signed rate with its unit
 * and drops the parentheses: a bare +4.1 read as a quantity rather than a rate (#370). `paused` is understanding
 * halted by a brownout: the rate stays net of it (rates.ts), so the readout says paused instead of a gain (#387).
 * `unit` names compute as the current phase does.
 */
export function stripReadout(resource: StripResource, amount: number, rate: number, short: boolean, paused = false,
  unit: ComputeUnit = 'FLOP'): { shown: string; spoken: string } {
  const value = shownAmount(resource, amount, short, unit);
  const rateShown = paused ? 'paused' : shownRate(resource, rate, short, unit);
  const said = spoken(resource, amount, false, unit) + (paused ? ' (paused: brownout)'
    : ', ' + (rate >= 0 ? 'gaining ' : 'losing ') + spoken(resource, Math.abs(rate), true, unit));
  return { shown: short ? value + ' ' + rateShown : value + ' (' + rateShown + ')', spoken: STRIP_LABEL[resource].name + ': ' + said };
}
