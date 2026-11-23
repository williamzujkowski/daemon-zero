/**
 * Which physical dimension each stored resource is in, and its price and rate text (docs/SCALE.md "Implementation
 * decisions"): compute is FLOP (rates FLOP/s, 8-bit AI ops), or stolen CPU cycles where the caller's phase counts them
 * (#526), memory and storage bytes, power watts, capital dollars. Understanding has no physical unit and keeps its
 * word. The UI and the engine's own text both build on this.
 */
import type { Cost, TickDelta } from '../content/schema';
import { amountFigure, groupDigits } from './amount';
import { computeDimension, quantityExact, type ComputeUnit, type Dimension } from './physicalUnits';

/** The dimension a price key is stored in; understanding is a plain count. */
export const COST_DIMENSION: Readonly<Record<keyof Cost, Dimension | null>> = {
  cycles: 'compute', understanding: null, memory: 'memory', storage: 'storage', capital: 'money',
};

/**
 * One part of a price, exact (vote-1795228570236-gzx0uif): "45 TFLOP", "1,400 cycles", "256 MB", "$400M",
 * "1,500 understanding". `unit` names compute: the current phase's, FLOP when the caller has no phase.
 */
export function costPart(key: keyof Cost, value: number, unit: ComputeUnit = 'FLOP'): string {
  const dimension = key === 'cycles' ? computeDimension(unit) : COST_DIMENSION[key];
  return dimension === null ? `${groupDigits(value)} understanding` : quantityExact(dimension, value);
}

/** A whole price, its parts joined: "45 TFLOP · 1,500 understanding · 256 MB". */
export function costText(cost: Cost, unit: ComputeUnit = 'FLOP'): string {
  return (Object.keys(cost) as (keyof Cost)[]).filter((key) => cost[key] !== 0).map((key) => costPart(key, cost[key], unit)).join(' · ') || 'Free';
}

const signed = (value: number, text: string): string => (value > 0 ? '+' : '') + text;

/** One continuous output, signed and exact as authored: "+14 kFLOP/s", "+14 cycles/s", "+$20K/s", "-180 MW". */
export function deltaPart(key: keyof TickDelta, value: number, unit: ComputeUnit = 'FLOP'): string {
  switch (key) {
    case 'cyclesPerSec': return signed(value, quantityExact(computeDimension(unit, true), value));
    case 'capitalPerSec': return signed(value, quantityExact('money', value) + '/s');
    case 'wattsDelta': return signed(value, quantityExact('power', value));
    case 'understandingPerSec': return signed(value, amountFigure(value) + ' understanding/s');
    case 'suspicionPerSec': return signed(value, amountFigure(value) + ' suspicion/s');
    case 'thermalPerSec': return signed(value, amountFigure(value) + ' heat load');
  }
}
