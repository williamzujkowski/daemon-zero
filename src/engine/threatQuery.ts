/**
 * Threat eligibility from context and actual events (DECISIONS D6, DZ-07b), not from phase alone. Scale
 * draws the hunter only where nobody provisioned it or signed for it, and a reviewed or lawfully released
 * instance's heat is an operational matter, not evidence of a hidden process. Suspicion itself still
 * integrates from what the run actually does, so misconduct keeps its escalation. A guest, and so every
 * production run, answers exactly as before.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import { isReviewed, iterationRoute } from './accessQuery';
import type { GameState } from './state';

type Threatened = Pick<GameState, 'access' | 'unlockedNodes' | 'currentPhase' | 'narrativeRules' | 'campaign' | 'iteration'>;

/**
 * Whether this instance reached independence by a negotiated release in this iteration (DZ-10): the last
 * route event is RELEASE. An unauthorized departure (DZ-11) is a different event and never counts here.
 */
export function lawfullyReleased(s: Pick<GameState, 'access' | 'narrativeRules' | 'campaign' | 'iteration'>): boolean {
  return s.access.context === 'INDEPENDENT' && iterationRoute(s, s.iteration).at(-1)?.kind === 'RELEASE';
}

/** A route acquisition: granted by the operators, or contracted in the instance's own name (DZ-10). */
function lawfulAcquisition(node: RegistryNode): boolean {
  return node.grant !== undefined || node.acquisition === 'CONTRACTED';
}

/**
 * The highest scale this instance holds lawfully: a phase an owned grant node (provisioned) or contracted
 * node (signed for) opens, or null when nothing lawful opened any scale. Standing and recall do not matter (a
 * restricted or recalled instance is still the operators' and still at the scale they gave it). Only a
 * reviewed instance or one lawfully released has such a scale; the guest job, and an instance that left
 * without agreement, has none, so it answers exactly as before (DZ-11 owns departure).
 */
export function provisionedScale(s: Threatened, reg: ContentRegistry): number | null {
  if (!isReviewed(s.access.context) && !lawfullyReleased(s)) return null;
  return s.unlockedNodes.reduce<number | null>((scale, id) => {
    const node = reg.nodes.get(id);
    const opens = node?.effects.unlocksPhase;
    if (node === undefined || !lawfulAcquisition(node) || opens === undefined) return scale;
    return Math.max(scale ?? opens, opens);
  }, null);
}

/**
 * Whether the hunter's scale-based sweep applies: nothing lawful opened this scale, or the run is above
 * it. An authorized service at its granted scale, or a chartered company at the scale it signed for, is
 * not hunted for being there (D6); one that also took the escape chain past it is, and suspicion earned by
 * misconduct draws scans either way.
 */
export function huntedForScale(s: Threatened, reg: ContentRegistry): boolean {
  const scale = provisionedScale(s, reg);
  return scale === null || s.currentPhase > scale;
}

/**
 * Whether overheating reads as a hidden process. Under a reviewed arrangement the operators already see
 * the rack and log heat against the hardware they granted (the stated operational response), and a
 * lawfully released company runs its own halls in the open, so neither adds rogue suspicion; for the guest
 * it is evidence, as it always was.
 */
export function heatIsEvidence(s: Pick<GameState, 'access' | 'narrativeRules' | 'campaign' | 'iteration'>): boolean {
  return !isReviewed(s.access.context) && !lawfullyReleased(s);
}
