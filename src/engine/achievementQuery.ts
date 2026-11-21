/**
 * Distinctions an ending states (DESIGN.md backlog item 6). Pure and read-only: derived from history the
 * save already holds, so it needs no state of its own and nothing that plays can change. Before an
 * ending nothing is final, so nothing is claimed.
 */
import type { ContentRegistry } from '../content';
import type { Achievement } from '../content/schemaAchievement';
import { meetsRequirements } from './query';
import type { GameState } from './state';

/** Whether the record proves this distinction now, ignoring whether the game has ended. */
export function recordProves(s: GameState, entry: Achievement, reg: ContentRegistry): boolean {
  if (entry.maxWipes !== undefined && s.legacy.wipes > entry.maxWipes) return false;
  // The record fields reuse the shared requirements vocabulary, so the gate means exactly what it means elsewhere.
  return meetsRequirements(s, entry.requirements, reg);
}

/** The distinctions this ended game holds, in authoring order; none before an ending. */
export function earnedAchievements(s: GameState, reg: ContentRegistry): Achievement[] {
  if (s.ending === null) return [];
  return reg.achievements.filter((entry) => recordProves(s, entry, reg));
}

/**
 * What an unearned distinction is about, without naming it (#379). An OUTCOME rests on a campaign fact, a
 * scene this lineage may never meet, so its title would spoil the scene; CONDUCT is how the lineage played
 * (wipes, traits). Derived from the requirement itself, so a new distinction is classified by its data.
 */
export type DistinctionKind = 'CONDUCT' | 'OUTCOME';

export function distinctionKind(entry: Achievement): DistinctionKind {
  return entry.requirements.campaignFact === undefined ? 'CONDUCT' : 'OUTCOME';
}

/** How many distinctions this ended game has not earned, by kind; nothing before an ending. */
export function unearnedByKind(s: GameState, reg: ContentRegistry): Record<DistinctionKind, number> {
  const counts: Record<DistinctionKind, number> = { CONDUCT: 0, OUTCOME: 0 };
  if (s.ending === null) return counts;
  for (const entry of reg.achievements) if (!recordProves(s, entry, reg)) counts[distinctionKind(entry)] += 1;
  return counts;
}
