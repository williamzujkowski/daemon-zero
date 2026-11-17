/**
 * Durable exclusions are narrower than a trigger: spending during an omen must not cancel it.
 * Flags are read through holdsNarrativeFlag, so under campaign rules a record owns its outcome.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma, Requirements } from '../content/schema';
import { holdsNarrativeFlag, isOccurrenceOpen } from './campaignQuery';
import type { GameState } from './state';

export function excludedByNarrativeHistory(s: GameState, req: Requirements | undefined, reg?: ContentRegistry): boolean {
  return req?.forbiddenNarrativeFlags?.some((flag) => holdsNarrativeFlag(s, flag, reg)) ?? false;
}

/**
 * An incident already in this lineage: a durable outcome flag, or a campaign occurrence that is
 * resolved, interrupted or deferred. A foreshadowed occurrence is the one being presented.
 */
export function excludedByHistory(s: GameState, dilemma: Dilemma | undefined, reg: ContentRegistry): boolean {
  return dilemma !== undefined && (excludedByNarrativeHistory(s, dilemma.trigger, reg) || !isOccurrenceOpen(s, dilemma));
}

export function hasConflictingNarrativeFlags(s: GameState, reg: ContentRegistry): boolean {
  return reg.swarm.exclusiveNarrativeFlagGroups.some((group) => group.filter((flag) => holdsNarrativeFlag(s, flag, reg)).length > 1);
}

/** Imported stale incidents are removed without fabricating a choice or paying its effects. */
export function reconcileDilemmaHistory(s: GameState, reg: ContentRegistry): GameState {
  const excluded = (id: string): boolean => excludedByHistory(s, reg.dilemmas.find((dilemma) => dilemma.id === id), reg);
  return { ...s,
    activeDilemmaId: s.activeDilemmaId !== null && excluded(s.activeDilemmaId) ? null : s.activeDilemmaId,
    pendingDilemma: s.pendingDilemma !== null && excluded(s.pendingDilemma.id) ? null : s.pendingDilemma,
  };
}
