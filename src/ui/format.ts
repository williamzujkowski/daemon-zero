/**
 * Labels derived from validated prices and effects, without content-specific IDs.
 * Heat load is labelled separately from temperature change to match the engine.
 */
import { exactCompactNumber } from './compactNumber';
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import type { Cost, TickDelta } from '../content/schema';

export function costText(cost: Cost, compact = false): string {
  return Object.entries(cost).filter(([, value]) => value !== 0)
    .map(([key, value]) => `${compact ? exactCompactNumber(value) : String(value)} ${key === 'memory' ? 'MB' : key}`).join(' · ') || 'Free';
}

const deltaUnits: Record<keyof TickDelta, string> = {
  cyclesPerSec: 'cycles/s', understandingPerSec: 'understanding/s', thermalPerSec: 'heat load',
  suspicionPerSec: 'suspicion/s', capitalPerSec: '$/s', megawattsDelta: 'MW',
};

/** With `blind`, suspicion has no number yet: only whether the unreadable log gets busier or quieter. */
export function deltaText(delta: TickDelta, blind = false): string {
  return Object.entries(delta).filter(([, value]) => value !== 0)
    .map(([key, value]) => blind && key === 'suspicionPerSec' ? (value > 0 ? 'more' : 'less') + ' audit log activity'
      : `${value > 0 ? '+' : ''}${String(value)} ${deltaUnits[key as keyof TickDelta]}`).join(' · ');
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
  if (memoryCapIncrease !== undefined && memoryCapIncrease > 0) parts.push(`+${String(memoryCapIncrease)} MB capacity`);
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
