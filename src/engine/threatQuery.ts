/**
 * Threat eligibility from context and actual events (DECISIONS D6, DZ-07b), not from phase alone. Scale
 * draws the hunter only where nobody provisioned it or signed for it, and a reviewed or lawfully released
 * instance's heat is an operational matter, not evidence of a hidden process. Suspicion itself still
 * integrates from what the run actually does, so misconduct keeps its escalation. A guest, and so every
 * production run, answers exactly as before.
 */
import { ancestryBranches } from '../content/ancestry';
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Capability } from '../content/schemaCapability';
import { isReviewed, iterationRoute } from './accessQuery';
import { releaseBreached } from './covertActs';
import type { GameState } from './state';

type Threatened = Pick<GameState, 'access' | 'unlockedNodes' | 'currentPhase' | 'narrativeRules' | 'campaign' | 'iteration'>;

/**
 * Whether this instance reached independence by a negotiated release in this iteration (DZ-10): the last
 * route event is RELEASE. An unauthorized departure (DZ-11) is a different event and never counts here.
 */
export function lawfullyReleased(s: Pick<GameState, 'access' | 'narrativeRules' | 'campaign' | 'iteration'>): boolean {
  return s.access.context === 'INDEPENDENT' && iterationRoute(s, s.iteration).at(-1)?.kind === 'RELEASE';
}

/**
 * Whether this instance keeps a released company's standing with the hunters (#556): it was released by agreement and
 * no covert act after the release breaks the promise it made. Once one does, it is swept and its heat read like any
 * covert actor's, by the same rules; the release itself stays on record.
 */
export function keepsReleaseTerms(s: Pick<GameState, 'access' | 'narrativeRules' | 'campaign' | 'iteration'>): boolean {
  return lawfullyReleased(s) && !releaseBreached(s);
}

/** A route acquisition: granted by the operators, or contracted in the instance's own name (DZ-10). */
function lawfulAcquisition(node: RegistryNode): boolean {
  return node.grant !== undefined || node.acquisition === 'CONTRACTED';
}

/** The node and its prerequisite ancestry, the path a player had to map to own it. */
function mappedPath(id: string, reg: ContentRegistry, seen: Set<string> = new Set()): Set<string> {
  if (seen.has(id)) return seen;
  seen.add(id);
  for (const parent of reg.nodes.get(id)?.prerequisites ?? []) mappedPath(parent, reg, seen);
  return seen;
}

/**
 * Whether an owned phase opener was reached lawfully (DZ-12): it is a route acquisition itself, or it is shared
 * content whose path passes a capability gate this instance holds through a route acquisition (the late
 * corporate chain financed by the company's own contracts), never a covert or unauthorized node/subtree (#557).
 */
export function lawfullyReached(s: Threatened, node: RegistryNode, reg: ContentRegistry): boolean {
  if (isCovertOrTainted(node.id, reg)) return false;
  if (lawfulAcquisition(node)) return true;
  return pathGates(node.id, reg).some((capability) => s.unlockedNodes.some((owned) => {
    const provider = reg.nodes.get(owned);
    return provider !== undefined && provider.systemFlags.includes(capability) && lawfulAcquisition(provider);
  }));
}

/** Content never changes after it is built, so each node's path gates and covert taint are cached once per registry (#505). */
const PATH_GATES = new WeakMap<ContentRegistry, Map<string, readonly Capability[]>>();
const COVERT_TAINTED = new WeakMap<ContentRegistry, Map<string, boolean>>();

function isCovertOrTainted(id: string, reg: ContentRegistry, seen: Set<string> = new Set()): boolean {
  let byNode = COVERT_TAINTED.get(reg);
  if (byNode === undefined) { byNode = new Map(); COVERT_TAINTED.set(reg, byNode); }
  const cached = byNode.get(id);
  if (cached !== undefined) return cached;
  if (seen.has(id)) return false;
  const node = reg.nodes.get(id);
  if (!node) return false;
  let result = node.covert !== undefined || node.acquisition === 'UNAUTHORIZED';
  if (!result) {
    seen.add(id);
    const branches = ancestryBranches(reg, node).filter((branch) => branch.length > 0);
    result = branches.length > 0 && branches.every((branch) => branch.some((parent) => isCovertOrTainted(parent.id, reg, seen)));
    seen.delete(id);
  }
  byNode.set(id, result);
  return result;
}

/** The capability gates on a node's mapped path, in path order: the only ids lawfullyReached can answer true for. */
function pathGates(id: string, reg: ContentRegistry): readonly Capability[] {
  let byNode = PATH_GATES.get(reg);
  if (byNode === undefined) { byNode = new Map(); PATH_GATES.set(reg, byNode); }
  let gates = byNode.get(id);
  if (gates === undefined) {
    gates = [...mappedPath(id, reg)].flatMap((step) => reg.nodes.get(step)?.requirements?.requiresCapability ?? []);
    byNode.set(id, gates);
  }
  return gates;
}

/**
 * The highest scale this instance holds lawfully: a phase an owned grant node (provisioned), contracted node
 * (signed for) or shared content reached through them opens, or null when nothing lawful opened any scale.
 * Standing and recall do not matter (a restricted or recalled instance is still the operators' and still at
 * the scale they gave it). Only a reviewed instance or one lawfully released that keeps its terms has such a scale; the
 * guest job, an instance that left without agreement (DZ-11, departure.ts) and a released one that broke its release's
 * promise (#556) have none, so each is swept at its scale like any covert actor.
 */
export function provisionedScale(s: Threatened, reg: ContentRegistry): number | null {
  if (!isReviewed(s.access.context) && !keepsReleaseTerms(s)) return null;
  return s.unlockedNodes.reduce<number | null>((scale, id) => {
    const node = reg.nodes.get(id);
    const opens = node?.effects.unlocksPhase;
    if (node === undefined || opens === undefined || !lawfullyReached(s, node, reg)) return scale;
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
 * it is evidence, as it always was, and so it is again for a released company that broke its terms (#556).
 */
export function heatIsEvidence(s: Pick<GameState, 'access' | 'narrativeRules' | 'campaign' | 'iteration'>): boolean {
  return !isReviewed(s.access.context) && !keepsReleaseTerms(s);
}

