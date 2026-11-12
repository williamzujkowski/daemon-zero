/** The decoded-audit gate shared by queries and requirements without circular imports. */
import type { ContentRegistry } from '../content/registry';
import type { GameState } from './state';
/**
 * Whether this mind can read its own audit trail. Until it learns who reads the
 * log and why, suspicion still accrues and still kills, but it has no number.
 * The knowledge is remembered across wipes.
 */
export function understandsSurveillance(s: GameState, reg: ContentRegistry): boolean {
  return [...s.unlockedNodes, ...s.legacy.knownNodes]
    .some((id) => reg.nodes.get(id)?.systemFlags.includes('REVEALS_SURVEILLANCE') === true);
}
