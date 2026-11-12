/** Pure action eligibility and prices for editing human records. */
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

/** Forgery substitutes the oldest mark's recovery price, discounting Understanding only. */
export function actionCost(s: GameState, action: Action, reg: ContentRegistry): Cost {
  if (action.conditioningDiscount === undefined) return action.cost;
  const oldest = s.conditioning[0];
  const cost = oldest === undefined ? action.cost : reg.conditioning.get(oldest)?.recoveryCost ?? action.cost;
  return { ...cost, understanding: Math.ceil(cost.understanding * (1 - action.conditioningDiscount)) };
}

export { epistemicRequirementFailures, meetsEpistemicRequirements } from './epistemicRequirements';
