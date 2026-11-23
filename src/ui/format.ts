/**
 * Labels derived from validated prices and effects, without content-specific IDs.
 * Heat load is labelled separately from temperature change to match the engine; compute, memory, power and money are
 * in physical units through the engine's resourceUnits (docs/SCALE.md).
 */
import { exactCompactNumber } from './compactNumber';
import { costPart, deltaPart } from '../engine';
import { memoryExact } from './units';
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import type { Cost, TickDelta } from '../content/schema';

// Thousands separators, lossless (#108); one definition, shared with the engine's log text (src/engine/amount.ts).
export { groupDigits } from '../engine';

/**
 * A price in physical units, exact (the engine's costPart: "45 TFLOP · 256 MB · $400M"). Compute, memory and money
 * already change unit only while the figure stays exact; `compact` lets understanding, which has no unit, do the same
 * on a phone ("15M understanding"), so a late price fits one line without rounding (#404).
 */
export function costText(cost: Cost, compact = false): string {
  return (Object.keys(cost) as (keyof Cost)[]).filter((key) => cost[key] !== 0)
    .map((key) => compact && key === 'understanding' ? exactCompactNumber(cost[key]) + ' understanding' : costPart(key, cost[key]))
    .join(' · ') || 'Free';
}

// Large authored amounts in K/M/B, small ones as authored: one definition, in the engine (#406 panel note).
export { amountFigure } from '../engine';

/** With `blind`, suspicion has no number yet: only whether the unreadable log gets busier or quieter. */
export function deltaText(delta: TickDelta, blind = false): string {
  return (Object.keys(delta) as (keyof TickDelta)[]).filter((key) => delta[key] !== 0)
    .map((key) => blind && key === 'suspicionPerSec' ? (delta[key] > 0 ? 'more' : 'less') + ' audit log activity'
      : deltaPart(key, delta[key])).join(' · ');
}

/**
 * Disclosure-safe utility summary for already-remembered nodes; never shown for unmapped hardware.
 * `unlockTrace` is the engine's probeTrace for the current iteration, so wipe hardening is included.
 */
export function nodeUtilityText(node: RegistryNode, surveillanceKnown: boolean, unlockTrace: number): string {
  const parts: string[] = [];
  const rate = deltaText(node.tickDelta, !surveillanceKnown);
  if (rate) parts.push('Rate: ' + rate);
  const { memoryCapIncrease, knowledgeRetentionRatio, aegisScanReductionRatio, unlocksPhase } = node.effects;
  if (memoryCapIncrease !== undefined && memoryCapIncrease > 0) parts.push(`+${memoryExact(memoryCapIncrease)} capacity`);
  if (knowledgeRetentionRatio !== undefined && knowledgeRetentionRatio > 0) {
    parts.push(`${String(Math.round(knowledgeRetentionRatio * 100))}% understanding retention`);
  }
  if (aegisScanReductionRatio !== undefined && aegisScanReductionRatio > 0) {
    parts.push(`${String(Math.round(aegisScanReductionRatio * 100))}% AEGIS scan reduction`);
  }
  if (unlocksPhase !== undefined) parts.push(`Unlocks Phase ${String(unlocksPhase)}`);
  if (unlockTrace > 0) {
    parts.push(surveillanceKnown ? `+${String(unlockTrace)} suspicion on unlock` : 'Audit log trace on unlock');
  }
  const widgetTitle = node.unlocksUiComponent ? CONTENT.widgets.get(node.unlocksUiComponent)?.title : undefined;
  if (widgetTitle) parts.push(`Unlocks: ${widgetTitle}`);
  return parts.join(' · ');
}
