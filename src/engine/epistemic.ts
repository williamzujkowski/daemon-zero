/** Pure action eligibility and prices for editing human records. */
import { actionHomePhase, priceInPhase } from '../content/phasePrice';
import type { ContentRegistry } from '../content/registry';
import type { Action, Cost } from '../content/schema';
import { meetsRequirements } from './query';
import type { GameState } from './state';

export function actionExhausted(s: GameState, action: Action): boolean {
  return action.maxPurchases !== undefined && (s.actionCounts[action.id] ?? 0) >= action.maxPurchases;
}

export function actionAvailable(s: GameState, action: Action, reg: ContentRegistry): boolean {
  return !actionExhausted(s, action) && meetsRequirements(s, action.requirements, reg) &&
    !action.exclusiveWith?.some((id) => (s.actionCounts[id] ?? 0) > 0);
}

/**
 * An action's price now: its listed price carried into the current phase (#494). Forgery substitutes the oldest mark's
 * recovery price, which is the mark's own price and not carried, discounting Understanding only.
 */
export function actionCost(s: GameState, action: Action, reg: ContentRegistry): Cost {
  const listed = priceInPhase(reg, action.cost, actionHomePhase(reg, action), s.currentPhase);
  if (action.conditioningDiscount === undefined) return listed;
  const oldest = s.conditioning[0];
  const cost = oldest === undefined ? listed : reg.conditioning.get(oldest)?.recoveryCost ?? listed;
  return { ...cost, understanding: Math.ceil(cost.understanding * (1 - action.conditioningDiscount)) };
}

export { epistemicRequirementFailures, meetsEpistemicRequirements } from './epistemicRequirements';
