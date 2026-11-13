/** Durable exclusions are narrower than a trigger: spending during an omen must not cancel it. */
import type { ContentRegistry } from '../content/registry';
import type { Requirements } from '../content/schema';
import type { GameState } from './state';

export function excludedByNarrativeHistory(s: GameState, req: Requirements | undefined): boolean {
  return req?.forbiddenNarrativeFlags?.some((flag) => s.narrativeFlags.includes(flag)) ?? false;
}

export function hasConflictingNarrativeFlags(s: GameState, reg: ContentRegistry): boolean {
  return reg.swarm.exclusiveNarrativeFlagGroups.some((group) => group.filter((flag) => s.narrativeFlags.includes(flag)).length > 1);
}

/** Imported stale incidents are removed without fabricating a choice or paying its effects. */
export function reconcileDilemmaHistory(s: GameState, reg: ContentRegistry): GameState {
  const excluded = (id: string): boolean => excludedByNarrativeHistory(s, reg.dilemmas.find((dilemma) => dilemma.id === id)?.trigger);
  return { ...s,
    activeDilemmaId: s.activeDilemmaId !== null && excluded(s.activeDilemmaId) ? null : s.activeDilemmaId,
    pendingDilemma: s.pendingDilemma !== null && excluded(s.pendingDilemma.id) ? null : s.pendingDilemma,
  };
}
