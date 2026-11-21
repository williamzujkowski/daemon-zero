/**
 * What a warning tells the player to do (#369, fix batch F2): each names the remedy the mechanics allow and where it
 * is, not only the problem. Shared by the in-game warnings and the game menu's status lines so they say the same.
 */
import { CONTENT } from '../content';
import { actuatorLimit, financeEnabled, isActuatorAvailable, repeatableLevel, type GameState } from '../engine';
import { profitAllocationValues } from './actuatorSteps';

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
 * Insolvency: each lever is named only when it can act (#402 panel). The FINANCE dial is offered only with an active
 * corporate entity, the way Allocation() decides, and only helps below its top setting; operatives can be released in
 * PAYROLL (dismissRepeatable) only if some are hired.
 */
export function insolvencyRemedy(game: GameState): string {
  const ratio = game.actuators.computeProfitAllocationRatio;
  const top = Math.min(actuatorLimit(game, 'computeProfitAllocationRatio', CONTENT), Math.max(...profitAllocationValues(CONTENT)));
  const divert = isActuatorAvailable(game, 'computeProfitAllocationRatio', CONTENT) && financeEnabled(game, CONTENT) && ratio < top - 1e-6;
  const release = [...CONTENT.repeatables.values()].some((rep) => rep.dismissable && repeatableLevel(game, rep.id) > 0);
  if (divert && release) return 'Divert more compute to revenue in FINANCE, or release operatives in PAYROLL.';
  if (divert) return 'Divert more compute to revenue in FINANCE.';
  if (release) return 'Release operatives in PAYROLL.';
  return 'Capital recovers only as revenue outgrows what the company pays each second.';
}

/**
 * When a rung stands down: suspicion must fall the hysteresis below the rung it reached (systems/escalation.ts), one
 * rung at a time. Null at NOMINAL, which has nothing to stand down from.
 */
export function standDownBelow(level: number): number | null {
  const rung = CONTENT.balance.escalation[level - 1];
  return rung ? Math.max(0, rung.at - CONTENT.balance.escalationHysteresis) : null;
}
