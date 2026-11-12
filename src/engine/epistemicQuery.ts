/** Read-only, disclosure-safe projections of human-record edits. No action execution. */
import type { ContentRegistry } from '../content/registry';
import type { Action } from '../content/schema';
import type { GameState } from './state';
import { actionCost, actionExhausted } from './epistemic';
import { canAfford, understandsSurveillance } from './query';
import { formatCost, pausedReason, requirementLabels } from './queryPresentation';
export function epistemicActionVisible(s: GameState, action: Action, reg: ContentRegistry): boolean {
  return action.requirements.requiresSurveillance === true && understandsSurveillance(s, reg) &&
    s.currentPhase >= (action.requirements.phaseAtLeast ?? 0) && !actionExhausted(s, action) &&
    !action.exclusiveWith?.some((id) => (s.actionCounts[id] ?? 0) > 0);
}
export function epistemicActionView(s: GameState, action: Action, reg: ContentRegistry) {
  const cost = actionCost(s, action, reg), cooldown = Math.max(0, Math.ceil((s.cooldowns[action.id] ?? 0) - s.simTimeSec));
  const unmet = [...requirementLabels(s, action.requirements, reg), ...pausedReason(s)];
  if (!canAfford(s, cost)) unmet.push('Insufficient resources: ' + formatCost(cost));
  if (cooldown > 0) unmet.push(`Cooldown: ${String(cooldown)}s`);
  return { id: action.id, title: action.label, description: action.description, cost, costLabel: formatCost(cost),
    cooldown, status: cooldown > 0 ? 'COOLDOWN' : 'READY', unmet,
    eligible: epistemicActionVisible(s, action, reg) && unmet.length === 0 };
}
export function epistemicView(s: GameState, reg: ContentRegistry) {
  if (!understandsSurveillance(s, reg)) return null;
  return { drift: s.epistemicDrift, status: s.epistemicDrift === 0 ? 'CONSISTENT' : s.epistemicDrift < 35 ? 'DISCREPANCIES' : 'CONFLICTING RECORDS',
    actions: [...reg.actions.values()].filter((action) => epistemicActionVisible(s, action, reg)).map((action) => epistemicActionView(s, action, reg)) };
}
