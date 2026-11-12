/** Pure action eligibility and prices for editing human records. */
import type { ContentRegistry } from '../content/registry';
import type { Action, Cost, Requirements } from '../content/schema';
import { meetsRequirements, understandsSurveillance, type RequirementFailure } from './query';
import type { GameState } from './state';

export function epistemicRequirementFailures(s: GameState, req: Requirements, reg?: ContentRegistry): RequirementFailure[] {
  const out: RequirementFailure[] = [];
  if (req.requiresSurveillance && (!reg || !understandsSurveillance(s, reg))) out.push({ kind: 'requiresSurveillance', target: null, required: true, actual: false });
  if (req.minEpistemicDrift !== undefined && s.epistemicDrift < req.minEpistemicDrift) out.push({ kind: 'minEpistemicDrift', target: null, required: req.minEpistemicDrift, actual: s.epistemicDrift });
  if (req.requiredNarrativeFlag && !s.narrativeFlags.includes(req.requiredNarrativeFlag)) out.push({ kind: 'requiredNarrativeFlag', target: req.requiredNarrativeFlag, required: true, actual: false });
  for (const flag of req.forbiddenNarrativeFlags ?? []) if (s.narrativeFlags.includes(flag)) out.push({ kind: 'forbiddenNarrativeFlags', target: flag, required: false, actual: true });
  if (req.requiresActiveConditioningMark && s.conditioning.length === 0) out.push({ kind: 'requiresActiveConditioningMark', target: null, required: true, actual: false });
  if (req.requiresMaxDriftShardAnomaly && !s.hasMaxDriftShardAnomaly) out.push({ kind: 'requiresMaxDriftShardAnomaly', target: null, required: true, actual: false });
  return out;
}

export function meetsEpistemicRequirements(s: GameState, req: Requirements, reg?: ContentRegistry): boolean {
  return epistemicRequirementFailures(s, req, reg).length === 0;
}

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
