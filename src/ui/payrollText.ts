/**
 * Sentences for the payroll totals and inert-effect notes (#210), from the engine's payrollView only.
 * Pure, so the wording is tested without mounting the screen.
 */
import type { TickDelta } from '../content/schema';
import { deltaPart, quantityReadout, type PayrollView } from '../engine';
import { compactNumber } from './compactNumber';
import { groupDigits } from './format';

/** The order totals are listed in; compute, money and power carry their physical units (docs/SCALE.md). */
const KEYS: readonly (keyof TickDelta)[] = ['cyclesPerSec', 'understandingPerSec', 'thermalPerSec', 'suspicionPerSec', 'capitalPerSec', 'wattsDelta'];
const WORDS: Partial<Record<keyof TickDelta, string>> = { understandingPerSec: 'understanding/s', thermalPerSec: 'heat load', suspicionPerSec: 'suspicion/s' };

export function percent(share: number): string {
  return String(Math.round(share * 100)) + '%';
}

/** Suspicion keeps hundredths (cards state 0.01 a level); every other total is whole units. */
function rounded(key: keyof TickDelta, value: number): number {
  return key === 'suspicionPerSec' ? Math.round(value * 100) / 100 : Math.round(value);
}

/** Exact as a card states it ("+26 kFLOP/s", "-$45,250/s"), or a three-digit readout when compact ("-$45.3K/s"). */
function amount(key: keyof TickDelta, value: number, compact: boolean): string {
  const sign = value > 0 ? '+' : '';
  const word = WORDS[key];
  if (word === undefined) {
    if (!compact) return deltaPart(key, value);
    if (key === 'capitalPerSec') return sign + quantityReadout('money', value) + '/s';
    return sign + quantityReadout(key === 'cyclesPerSec' ? 'computeRate' : 'power', value);
  }
  if (key === 'suspicionPerSec') return sign + String(value) + ' ' + word;
  return sign + (compact ? compactNumber(value) : groupDigits(value)) + ' ' + word;
}

/**
 * Every hired level's per-second figures, summed. `blind` follows the cards: before the mind knows what its
 * audit trail is for, suspicion is only "more" or "less" log activity. `compact` abbreviates large numbers.
 */
export function staffTotalsText(view: PayrollView, blind: boolean, compact = false): string {
  if (view.staffLevels === 0) return 'Staff: no one hired.';
  const parts = KEYS
    .map((key) => [key, rounded(key, view.totals[key])] as const).filter(([, value]) => value !== 0)
    .map(([key, value]) => blind && key === 'suspicionPerSec' ? (value > 0 ? 'more' : 'less') + ' audit log activity'
      : amount(key, value, compact));
  const levels = String(view.staffLevels) + (view.staffLevels === 1 ? ' level' : ' levels');
  return `Staff (${levels}): ${parts.join(' · ') || 'no net output'}`;
}

export function revenueText(view: PayrollView): string {
  const multiplier = String(Math.round(view.revenueMultiplier * 100) / 100);
  return `Revenue multiplier: ×${multiplier} (staff +${percent(view.staffRevenueBonus)})`;
}

/** The cap as a player reads it: the effective cap, and where AEGIS adaptation lowered it from (#463). */
function capText(view: PayrollView): string {
  const { cap, nominalCap } = view.aegis;
  return percent(cap) === percent(nominalCap) ? `${percent(cap)} cap` : `${percent(cap)} cap, lowered from ${percent(nominalCap)} by AEGIS adaptation`;
}

/** The applied reduction against its cap, with where it comes from, and what the cap means for a hire. */
export function aegisTotalText(view: PayrollView): string {
  const { tech, staff, applied, capped } = view.aegis;
  const sources = [tech > 0 ? 'systems ' + percent(tech) : '', staff > 0 ? 'staff ' + percent(staff) : ''].filter(Boolean);
  const from = sources.length > 0 ? ` (${sources.join(', ')})` : '';
  return capped ? `AEGIS scan reduction: ${percent(applied)}, at its ${capText(view)}${from}. More AEGIS levels add nothing.`
    : `AEGIS scan reduction: ${percent(applied)} of a ${capText(view)}${from}.`;
}

export function suspicionFloorText(blind: boolean): string {
  return blind ? 'The audit log is quiet and holding: quieting it adds nothing now.'
    : 'Suspicion is 0 and holding: cuts add nothing now.';
}

export function roleAegisCappedText(view: PayrollView): string {
  return `No AEGIS effect while capped: the reduction is at its ${capText(view)}.`;
}

export function roleAegisPartialText(next: number, view: PayrollView): string {
  const gain = Math.round(next * 100) === 0 ? 'under 1%' : percent(next);
  return `The next level adds only ${gain} before the ${capText(view)}.`;
}

export function roleSuspicionInertText(blind: boolean): string {
  return blind ? 'No audit-log effect while the log is quiet.' : 'No suspicion effect while suspicion is 0.';
}
