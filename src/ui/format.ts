/**
 * Labels derived from validated prices and effects, without content-specific IDs.
 * Heat load is labelled separately from temperature change to match the engine.
 */
import { exactCompactNumber } from './compactNumber';
import type { Cost, TickDelta } from '../content/schema';

export function costText(cost: Cost, compact = false): string {
  return Object.entries(cost).filter(([, value]) => value !== 0)
    .map(([key, value]) => `${compact ? exactCompactNumber(value) : String(value)} ${key === 'memory' ? 'MB' : key}`).join(' · ') || 'Free';
}

const deltaUnits: Record<keyof TickDelta, string> = {
  cyclesPerSec: 'cycles/s', understandingPerSec: 'understanding/s', thermalPerSec: 'heat load',
  suspicionPerSec: 'suspicion/s', capitalPerSec: '$/s', megawattsDelta: 'MW',
};

/** With `blind`, suspicion has no number yet: only whether the unreadable log gets busier or quieter. */
export function deltaText(delta: TickDelta, blind = false): string {
  return Object.entries(delta).filter(([, value]) => value !== 0)
    .map(([key, value]) => blind && key === 'suspicionPerSec' ? (value > 0 ? 'more' : 'less') + ' audit log activity'
      : `${value > 0 ? '+' : ''}${String(value)} ${deltaUnits[key as keyof TickDelta]}`).join(' · ');
}
