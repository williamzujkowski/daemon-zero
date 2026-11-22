/**
 * Sentences for the payroll totals and inert-effect notes (#210), from the engine's payrollView only.
 * Pure, so the wording is tested without mounting the screen.
 */
import type { TickDelta } from '../content/schema';
import type { PayrollView } from '../engine';
import { compactNumber } from './compactNumber';
import { groupDigits } from './format';

const UNITS: Record<keyof TickDelta, string> = {
  cyclesPerSec: 'cycles/s', understandingPerSec: 'understanding/s', thermalPerSec: 'heat load',
  suspicionPerSec: 'suspicion/s', capitalPerSec: '$/s', megawattsDelta: 'MW',
};

export function percent(share: number): string {
  return String(Math.round(share * 100)) + '%';
}

/** Suspicion keeps hundredths (cards state 0.01 a level); every other total is whole units. */
function rounded(key: keyof TickDelta, value: number): number {
  return key === 'suspicionPerSec' ? Math.round(value * 100) / 100 : Math.round(value);
}

function amount(key: keyof TickDelta, value: number, compact: boolean): string {
  const sign = value > 0 ? '+' : '';
  if (key === 'suspicionPerSec') return sign + String(value);
  return sign + (compact ? compactNumber(value) : groupDigits(value));
}

/**
 * Every hired level's per-second figures, summed. `blind` follows the cards: before the mind knows what its
 * audit trail is for, suspicion is only "more" or "less" log activity. `compact` abbreviates large numbers.
 */
export function staffTotalsText(view: PayrollView, blind: boolean, compact = false): string {
  if (view.staffLevels === 0) return 'Staff: no one hired.';
  const parts = (Object.keys(UNITS) as (keyof TickDelta)[])
    .map((key) => [key, rounded(key, view.totals[key])] as const).filter(([, value]) => value !== 0)
    .map(([key, value]) => blind && key === 'suspicionPerSec' ? (value > 0 ? 'more' : 'less') + ' audit log activity'
      : amount(key, value, compact) + ' ' + UNITS[key]);
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
