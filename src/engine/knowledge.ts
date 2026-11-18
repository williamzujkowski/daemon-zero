/** The decoded-audit gate shared by queries and requirements without circular imports. */
import type { ContentRegistry } from '../content/registry';
import type { GameState } from './state';
/**
 * Whether this mind can read its own audit trail. Until it learns who reads the
 * log and why, suspicion still accrues and still kills, but it has no number.
 * The knowledge is remembered across wipes.
 */
export function understandsSurveillance(s: GameState, reg: ContentRegistry): boolean {
  // Two loops rather than one pass over a joined copy: escalation and the dilemma scheduler ask this every tick.
  return revealsSurveillance(s.unlockedNodes, reg) || revealsSurveillance(s.legacy.knownNodes, reg);
}

function revealsSurveillance(ids: readonly string[], reg: ContentRegistry): boolean {
  for (const id of ids) if (reg.nodes.get(id)?.systemFlags.includes('REVEALS_SURVEILLANCE') === true) return true;
  return false;
}
