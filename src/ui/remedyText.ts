/**
 * What a warning tells the player to do (#369, fix batch F2): each names the remedy the mechanics allow and where it
 * is, not only the problem. Shared by the in-game warnings and the game menu's status lines so they say the same.
 */
import { CONTENT } from '../content';
import { actuatorLimit, financeEnabled, isActuatorAvailable, repeatableLevel, type GameState } from '../engine';
import { profitAllocationValues } from './actuatorSteps';

/** Running processes PROC can suspend whose output adds to a rate (heat or suspicion): the PROC lever's reach. */
function runningSources(game: GameState, rate: 'thermalPerSec' | 'suspicionPerSec'): boolean {
  return game.unlockedNodes.some((id) => {
    const node = CONTENT.nodes.get(id);
    return node !== undefined && node.suspendable && !game.disabledNodes.includes(id) && node.tickDelta[rate] > 0;
  });
}

/**
 * Overheat: each lever named only when it can act (#402 panel). The fan while it is below its limit; PROC while a
 * heat-producing process is running (PROC suspends processes, never hardware). With neither, it says so.
 */
export function overheatRemedy(game: GameState): string {
  const fanAvailable = isActuatorAvailable(game, 'fanSpeedRatio', CONTENT);
  const fan = fanAvailable && game.actuators.fanSpeedRatio < actuatorLimit(game, 'fanSpeedRatio', CONTENT) - 1e-6;
  const proc = runningSources(game, 'thermalPerSec');
  if (fan && proc) return 'Raise fan output, or suspend heat-producing processes in PROC.';
  if (fan) return 'Raise fan output.';
  if (proc) return fanAvailable ? 'The fan is at full: suspend heat-producing processes in PROC.' : 'Suspend heat-producing processes in PROC.';
  return 'No running process can be suspended to cool it, and the fan is at full.';
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
 * What brings a rung back down: suspicion must fall the hysteresis below the rung it reached (systems/escalation.ts),
 * one rung at a time. Each lever is named only when it can act: the skim above zero, PROC while a process that adds
 * suspicion is running (#402 panel). Null at NOMINAL, which has nothing to stand down from.
 */
export function standDownRemedy(game: GameState, level: number): string | null {
  const below = standDownBelow(level);
  if (below === null) return null;
  const skim = isActuatorAvailable(game, 'quotaSkimRatio', CONTENT) && game.actuators.quotaSkimRatio > 0;
  const proc = runningSources(game, 'suspicionPerSec');
  const levers = skim && proc ? 'lower the skim or suspend noisy processes in PROC' : skim ? 'lower the skim'
    : proc ? 'suspend noisy processes in PROC' : null;
  return `It stands down when suspicion falls below ${String(below)}%` + (levers ? `: ${levers}.` : ', as it decays.');
}

/**
 * When a rung stands down: suspicion must fall the hysteresis below the rung it reached (systems/escalation.ts), one
 * rung at a time. Null at NOMINAL, which has nothing to stand down from.
 */
export function standDownBelow(level: number): number | null {
  const rung = CONTENT.balance.escalation[level - 1];
  return rung ? Math.max(0, rung.at - CONTENT.balance.escalationHysteresis) : null;
}
