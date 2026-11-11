/**
 * Labels derived from validated prices and effects, without content-specific IDs.
 * Heat load is labelled separately from temperature change to match the engine.
 */
import type { Cost, TickDelta } from '../content/schema';

export function costText(cost: Cost): string {
  return Object.entries(cost).filter(([, value]) => value !== 0)
    .map(([key, value]) => `${String(value)} ${key === 'memory' ? 'MB' : key}`).join(' · ') || 'Free';
}

const deltaUnits: Record<keyof TickDelta, string> = {
  cyclesPerSec: 'cycles/s', understandingPerSec: 'understanding/s', thermalPerSec: 'heat load',
  suspicionPerSec: 'suspicion/s', capitalPerSec: '$/s', megawattsDelta: 'MW',
};

export function deltaText(delta: TickDelta): string {
  return Object.entries(delta).filter(([, value]) => value !== 0)
    .map(([key, value]) => `${value > 0 ? '+' : ''}${String(value)} ${deltaUnits[key as keyof TickDelta]}`).join(' · ');
}
