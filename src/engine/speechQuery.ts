/** Read-only decoded speech; recorded consequences never join the timed ambient rotation. */
import type { ContentRegistry } from '../content/registry';
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
