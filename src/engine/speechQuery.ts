/**
 * Read-only authored text chosen from world history: decoded speech, where recorded consequences
 * never join the timed ambient rotation, and the context a dilemma is presented with.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma } from '../content/schema';
import type { GameState } from './state';
import { meetsRequirements } from './query';

export function eligibleAmbientSpeech(s: GameState, reg: ContentRegistry, decoderId: string) {
  if (!s.unlockedWidgets.includes(decoderId)) return [];
  return reg.narrative.ambientChatter.filter((line) => line.minSuspicion <= s.suspicion && meetsRequirements(s, line.requirements, reg));
}

export function recordedTransmissions(s: GameState, reg: ContentRegistry, decoderId: string) {
  if (!s.unlockedWidgets.includes(decoderId)) return [];
  return reg.narrative.recordedTransmissions.filter((record) => record.decoderWidgetId === decoderId && meetsRequirements(s, record.requirements, reg));
}

/**
 * The context a dilemma is shown with: the first variant whose history holds, else the authored
 * default. Integrity limits variants to world history, so this cannot change while it is on screen.
 */
export function dilemmaContext(s: GameState, dilemma: Dilemma, reg: ContentRegistry): string {
  return dilemma.contextVariants?.find((variant) => meetsRequirements(s, variant.requirements, reg))?.context ?? dilemma.context;
}
