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
