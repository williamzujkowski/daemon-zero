/**
 * What a warning tells the player to do (#369, fix batch F2): each names the remedy the mechanics allow and where it
 * is, not only the problem. Shared by the in-game warnings and the game menu's status lines so they say the same.
 */
import { CONTENT } from '../content';

/** Overheat: the fan first while it has headroom, otherwise the hardware making the heat (suspended in PROC). */
export function overheatRemedy(fan: { available: boolean; full: boolean }): string {
  if (fan.available && !fan.full) return 'Raise fan output, or suspend hot hardware in PROC.';
  return fan.available ? 'The fan is at full: suspend hot hardware in PROC.' : 'Suspend hot hardware in PROC.';
}

/** Power: how far short, and the two ways back. */
export function shortfallText(generated: number, consumed: number): string {
  const short = Math.max(0, consumed - generated);
  return `POWER SHORTFALL: ${short.toFixed(0)} MW short; powered hardware is throttled. Add generation, or suspend powered hardware in PROC.`;
}

/** Insolvency: the company's two levers. */
export const INSOLVENCY_REMEDY = 'Divert more compute to revenue in FINANCE, or cut payroll in PAYROLL.';

/**
 * When a rung stands down: suspicion must fall the hysteresis below the rung it reached (systems/escalation.ts), one
 * rung at a time. Null at NOMINAL, which has nothing to stand down from.
 */
export function standDownBelow(level: number): number | null {
  const rung = CONTENT.balance.escalation[level - 1];
  return rung ? Math.max(0, rung.at - CONTENT.balance.escalationHysteresis) : null;
}
