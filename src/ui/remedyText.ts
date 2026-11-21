/**
 * What a warning tells the player to do (#369, fix batch F2): each names the remedy the mechanics allow and where it
 * is, not only the problem. Shared by the in-game warnings and the game menu's status lines so they say the same.
 */
import { CONTENT } from '../content';

/**
 * Overheat: the fan first while it has headroom, otherwise the software making the heat. PROC suspends processes,
 * never hardware (vote software-types-only-free-their-memory), and eleven suspendable processes produce heat.
 */
export function overheatRemedy(fan: { available: boolean; full: boolean }): string {
  if (fan.available && !fan.full) return 'Raise fan output, or suspend heat-producing processes in PROC.';
  return fan.available ? 'The fan is at full: suspend heat-producing processes in PROC.' : 'Suspend heat-producing processes in PROC.';
}

/**
 * Power: how far short, and the one way back. No suspendable process consumes power, and powered hardware cannot be
 * suspended, so PROC is not a remedy here (#402 panel).
 */
export function shortfallText(generated: number, consumed: number): string {
  const short = Math.max(0, consumed - generated);
  return `POWER SHORTFALL: ${short.toFixed(0)} MW short; powered hardware is throttled. Add generation to lift it.`;
}

/**
 * Insolvency: operatives can be released in PAYROLL (dismissRepeatable); the revenue dial in FINANCE exists only
 * with an active corporate entity, so it is named only when it is offered (#402 panel).
 */
export function insolvencyRemedy(allocation: boolean): string {
  return allocation ? 'Divert more compute to revenue in FINANCE, or release operatives in PAYROLL.' : 'Release operatives in PAYROLL.';
}

/**
 * When a rung stands down: suspicion must fall the hysteresis below the rung it reached (systems/escalation.ts), one
 * rung at a time. Null at NOMINAL, which has nothing to stand down from.
 */
export function standDownBelow(level: number): number | null {
  const rung = CONTENT.balance.escalation[level - 1];
  return rung ? Math.max(0, rung.at - CONTENT.balance.escalationHysteresis) : null;
}
