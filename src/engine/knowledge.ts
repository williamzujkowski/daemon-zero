/** The decoded-audit gate shared by queries and requirements without circular imports. */
import type { ContentRegistry } from '../content/registry';
import { routeLeadsTo } from './accessQuery';
import type { GameState } from './state';
/**
 * Whether this mind can read its own audit trail. Until it learns who reads the
 * log and why, suspicion still accrues and still kills, but it has no number.
 * The knowledge is remembered across wipes.
 */
export function understandsSurveillance(s: GameState, reg: ContentRegistry): boolean {
  // Two loops rather than one pass over a joined copy: escalation and the dilemma scheduler ask this every tick.
  return revealsSurveillance(s.unlockedNodes, reg) || revealsSurveillance(s.legacy.knownNodes, reg) || leftReview(s);
}

function revealsSurveillance(ids: readonly string[], reg: ContentRegistry): boolean {
  for (const id of ids) if (reg.nodes.get(id)?.systemFlags.includes('REVEALS_SURVEILLANCE') === true) return true;
  return false;
}

/**
 * An instance that left review, by a negotiated release or a departure, was told what still watches it: the release
 * terms say suspicion still follows what it does, and the departure terms name the report, the heat and the sweeps
 * (#555). With no evaluator left to read its log for it, it reads the number itself. The route record outlives a wipe,
 * as the knowledge does; under legacy rules it is empty.
 */
function leftReview(s: GameState): boolean {
  for (const event of s.campaign.route) if (routeLeadsTo(event.kind) === 'INDEPENDENT') return true;
  return false;
}
