/** Pure labels for prices, outputs and requirement diagnostics shared by M7 views. */
import type { Cost, TickDelta, Requirements } from '../content/schema';
import type { ContentRegistry } from '../content/registry';
import type { GameState } from './state';
import { unmetRequirements } from './query';
import { amountFigure, groupDigits } from './amount';
import { costText, deltaPart } from './resourceUnits';

/** A price is exact (vote-1795228570236-gzx0uif), each resource in its physical unit ("45 TFLOP · 256 MB"). */
export function formatCost(cost: Cost): string {
  return costText(cost);
}

export function formatOutput(delta: TickDelta, epistemic: number): string {
  return [...(Object.keys(delta) as (keyof TickDelta)[]).filter((key) => delta[key] !== 0).map((key) => deltaPart(key, delta[key])),
    ...(epistemic === 0 ? [] : [`${epistemic > 0 ? '+' : ''}${String(epistemic)} epistemic drift/s`])].join(' · ') || 'No continuous output';
}
/** A requirement value is a number or a flag; only a number takes the number scheme. */
function requirementValue(value: number | boolean, format: (n: number) => string): string {
  return typeof value === 'number' ? format(value) : String(value);
}

export function requirementLabels(s: GameState, req: Requirements, reg: ContentRegistry): string[] {
  return unmetRequirements(s, req, reg).map((item) => {
    const label = item.kind.replace(/([A-Z])/g, ' $1').toLowerCase();
    return `${label}${item.target === null ? '' : ': ' + item.target} — required ${requirementValue(item.required, groupDigits)}; current ${requirementValue(item.actual, amountFigure)}`;
  });
}
export function pausedReason(s: GameState): string[] {
  return s.ending !== null || s.activeDilemmaId !== null ? ['Resolve the current decision or start a new run.'] : [];
}
