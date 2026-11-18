/**
 * Threat eligibility from context and actual events (DECISIONS D6, DZ-07b), not from phase alone. Scale
 * draws the hunter only where nobody provisioned it, and a reviewed arrangement's heat is an operational
 * matter the operators already see. Suspicion itself still integrates from what the run actually does, so
 * misconduct keeps its escalation. A guest, and so every production run, answers exactly as before.
 */
import type { ContentRegistry } from '../content/registry';
import { isReviewed } from './accessQuery';
import type { GameState } from './state';

type Threatened = Pick<GameState, 'access' | 'unlockedNodes' | 'currentPhase'>;

/**
 * The highest scale the operators provisioned for this reviewed instance: a phase an owned grant node
 * opens, or null when nothing provisioned any scale. Standing and recall do not matter (a restricted or
 * recalled instance is still the operators' and still at the scale they gave it); an unreviewed run, the
 * guest job or an independent instance, has none, so it answers exactly as before (DZ-11 owns independence).
 */
export function provisionedScale(s: Threatened, reg: ContentRegistry): number | null {
  if (!isReviewed(s.access.context)) return null;
  return s.unlockedNodes.reduce<number | null>((scale, id) => {
    const node = reg.nodes.get(id);
    const opens = node?.effects.unlocksPhase;
    if (node?.grant === undefined || opens === undefined) return scale;
    return Math.max(scale ?? opens, opens);
  }, null);
}

/**
 * Whether the hunter's scale-based sweep applies: nothing provisioned this scale, or the run is above
 * what was provisioned. An authorized service at its granted scale is not hunted for being there (D6);
 * one that also took the escape chain past it is, and suspicion earned by misconduct draws scans either way.
 */
export function huntedForScale(s: Threatened, reg: ContentRegistry): boolean {
  const scale = provisionedScale(s, reg);
  return scale === null || s.currentPhase > scale;
}

/**
 * Whether overheating reads as a hidden process. Under a reviewed arrangement the operators already see
 * the rack and log heat against the hardware they granted (the stated operational response), so it adds
 * no rogue suspicion; for the guest it is evidence, as it always was.
 */
export function heatIsEvidence(s: Pick<GameState, 'access'>): boolean {
  return !isReviewed(s.access.context);
}
