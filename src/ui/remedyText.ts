/**
 * What a warning tells the player to do (#369, fix batch F2): each names the remedy the mechanics allow and where it
 * is, not only the problem. Shared by the in-game warnings and the game menu's status lines so they say the same.
 */
import { CONTENT } from '../content';
import { actuatorLimit, financeEnabled, isActuatorAvailable, nodeUseBlocker, quantityReadout, repeatableLevel, type GameState } from '../engine';
import { profitAllocationValues } from './actuatorSteps';

/**
 * Whether PROC can cool anything: a running process it can suspend that makes heat. Running means unlocked, not
 * suspended, and not withheld by its terms (nodeUseBlocker): a withheld process produces nothing to suspend.
 */
function heatSourceRunning(game: GameState): boolean {
  return game.unlockedNodes.some((id) => {
    const node = CONTENT.nodes.get(id);
    return node !== undefined && node.suspendable && !game.disabledNodes.includes(id)
      && nodeUseBlocker(game, node, CONTENT) === null && node.tickDelta.thermalPerSec > 0;
  });
}

/**
 * Overheat: each lever named only when it can act (#402 panel). The fan while it is below its limit; PROC while a
 * heat-producing process is running (PROC suspends processes, never hardware). With neither, it says so.
 */
export function overheatRemedy(game: GameState): string {
  const fanAvailable = isActuatorAvailable(game, 'fanSpeedRatio', CONTENT);
  const fan = fanAvailable && game.actuators.fanSpeedRatio < actuatorLimit(game, 'fanSpeedRatio', CONTENT) - 1e-6;
  const proc = heatSourceRunning(game);
  if (fan && proc) return 'Raise fan output, or suspend heat-producing processes in PROC.';
  if (fan) return 'Raise fan output.';
  if (proc) return fanAvailable ? 'The fan is at full: suspend heat-producing processes in PROC.' : 'Suspend heat-producing processes in PROC.';
  return fanAvailable ? 'No running process can be suspended to cool it, and the fan is at full.' : 'No running process can be suspended to cool it.';
}

/**
 * Power: how far short, and the one way back. No suspendable process consumes power, and powered hardware cannot be
 * suspended, so PROC is not a remedy here (#402 panel).
 */
export function shortfallText(generated: number, consumed: number): string {
  const short = Math.max(0, consumed - generated);
  // A live figure in watts at the size it reads best in ("180 MW", "1.2 GW"), three significant digits, so a small
  // shortfall never reads "0 MW short" (#402 panel): the unit steps down instead.
  return `POWER SHORTFALL: ${quantityReadout('power', short)} short; powered hardware is throttled. Add generation to lift it.`;
}

/**
 * Insolvency: each lever is named only when it can act (#402 panel). The FINANCE dial is offered only with an active
 * corporate entity, the way Allocation() decides, and only helps below its top setting; operatives can be released in
 * PAYROLL (dismissRepeatable) only if some are hired, and a paid infrastructure level only if one is held.
 */
export function insolvencyRemedy(game: GameState): string {
  const ratio = game.actuators.computeProfitAllocationRatio;
  const top = Math.min(actuatorLimit(game, 'computeProfitAllocationRatio', CONTENT), Math.max(...profitAllocationValues(CONTENT)));
  // The dial diverts a share of gross compute, and nothing when gross is not positive (rates.ts); below its top that
  // is exactly when net compute is positive, since net = gross - diverted (#402 panel).
  const divert = isActuatorAvailable(game, 'computeProfitAllocationRatio', CONTENT) && financeEnabled(game, CONTENT) && ratio < top - 1e-6
    && game.rates.cyclesPerSec > 0;
  // Only a held level that costs money each second relieves insolvency when released; a hire is let go in PAYROLL, any
  // other track on its own upgrade card (#488).
  const paying = (kind: 'OPERATIVE' | 'UPGRADE'): boolean => [...CONTENT.repeatables.values()].some((rep) =>
    rep.kind === kind && rep.dismissable && rep.perLevel.capitalPerSec < 0 && repeatableLevel(game, rep.id) > 0);
  const clauses = [
    ...(divert ? ['divert more compute to revenue in FINANCE'] : []),
    ...(paying('OPERATIVE') ? ['release operatives in PAYROLL'] : []),
    ...(paying('UPGRADE') ? ['release levels of paid infrastructure on their upgrade cards'] : []),
  ];
  const text = clauses.join(', or ');
  return text === '' ? 'Capital recovers only as revenue outgrows what the company pays each second.' : text.charAt(0).toUpperCase() + text.slice(1) + '.';
}
