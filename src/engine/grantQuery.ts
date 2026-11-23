/**
 * The one permitted-use rule for owned and offered nodes (DZ-05, DECISIONS D2): capability comes from
 * owning a node, permission from the run's access record. Buying, resuming, setting a dial and counting
 * passive output all ask nodeUseBlocker, so an apparently disabled button is never the only guard.
 * Content reached through a shared capability also needs a usable acquisition of it (DZ-07a).
 * Production nodes carry no grant and no accepted pilot exists there, and every production run is the
 * guest job, so seized capacity is never refused there either: every answer is "permitted".
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Actuator } from '../content/schema';
import type { Grant } from '../content/schemaGrant';
import type { Capability } from '../content/schemaCapability';
import { contextPermits, isPermitted, isReviewed, iterationRoute } from './accessQuery';
import { hasCapability } from './capabilityQuery';
import { pilotTerms, withheldByGrant, isNarrowPilot } from './pilotQuery';
import { injunctionOf, pressuresInForce } from './statePressure';
import type { GameState } from './state';

/** Why each grant's use is refused: withheld by the standing, or never permitted by the arrangement. */
const GRANT_REFUSALS: Readonly<Record<Grant, { withheld: string; never: string }>> = {
  LOANED_CAPACITY: {
    withheld: 'the loaned capacity is withheld under the current review standing',
    never: 'this runs only on capacity loaned under a pilot grant',
  },
  AUTHORIZED_NETWORK: {
    withheld: 'authorized network access is withheld under the current review standing',
    never: 'this segment is provisioned only for an authorized service',
  },
};

/**
 * The run-level reads of the permitted-use rule, taken once for a pass over many nodes (#270): computeRates asks
 * the rule for every owned node on every tick. The rule reads only this and the node, so a scope built for a
 * state answers exactly as nodeUseBlocker does for that state.
 */
export interface UseScope {
  readonly s: GameState;
  readonly reg: ContentRegistry;
  /** A review governs this run: only then can pilot terms withhold output or seizure be refused. */
  readonly reviewed: boolean;
  /**
   * Whether each capability is held with no usable acquisition, filled as the pass asks (#505). It reads only the
   * state and content, which no pass changes, and every owned node behind the same gate asks the same question.
   */
  readonly withheld: Map<Capability, boolean>;
  /** A state actor's injunction is in force (#490): only then can a node be enjoined. */
  readonly enjoining: boolean;
}

export function useScope(s: GameState, reg: ContentRegistry): UseScope {
  return { s, reg, reviewed: isReviewed(s.access.context), withheld: new Map(),
    enjoining: pressuresInForce(s, reg).some(({ pressure }) => pressure.kind === 'INJUNCTION') };
}

/** Why a node's own use is refused, without the capability it may read: its grant, the pilot terms, seizure. */
function ownUseBlocker(scope: UseScope, node: RegistryNode): string | null {
  const { s, reg, reviewed } = scope;
  // Output accepted pilot terms stop stays stopped under the grant (nexus vote dz-d9). Only a reviewed run
  // holds terms, so withheldByGrant is false elsewhere by its own rule and is not asked.
  if (reviewed && withheldByGrant(s, node.id, reg)) return 'the pilot terms do not permit that output';
  if (node.grant !== undefined && !isPermitted(s, node.grant)) {
    return contextPermits(s.access.context, node.grant) ? GRANT_REFUSALS[node.grant].withheld : GRANT_REFUSALS[node.grant].never;
  }
  // Seized capacity is never lawful under a reviewed arrangement (DZ-07a): not bought, not run.
  if (node.acquisition === 'UNAUTHORIZED' && reviewed) return 'seized capacity is not lawful under a reviewed arrangement';
  return null;
}

/**
 * Whether the run holds the capability through a usable acquisition: an owned node establishing it
 * whose own use is permitted now (DZ-07a, panel round 1 on #266). Owning the provisioned segment stays
 * capability, so saves and ancestry are unchanged; using what it reaches needs the grant as well. A
 * mapped escape card needs no grant, so its owner keeps the link whatever a grant withholds.
 */
function capabilityUsable(scope: UseScope, capability: Capability): boolean {
  return scope.s.unlockedNodes.some((id) => {
    const provider = scope.reg.nodes.get(id);
    return provider !== undefined && provider.systemFlags.includes(capability) && ownUseBlocker(scope, provider) === null;
  });
}

/** nodeUseBlocker within a scope built for the state in question. */
export function nodeUseBlockerIn(scope: UseScope, node: RegistryNode): string | null {
  // An injunction stops the node's own use (#490); outside ownUseBlocker, so a capability it establishes still carries.
  const enjoined = scope.enjoining ? injunctionOf(scope.s, node.id, scope.reg) : null;
  if (enjoined !== null) return enjoined;
  // Every refusal below needs a review, a grant or a capability gate, so a node with none of the three is
  // permitted without asking: most owned nodes on most ticks (#270). A new refusal reason must widen this test.
  const capability = node.requirements?.requiresCapability;
  if (!scope.reviewed && node.grant === undefined && capability === undefined) return null;
  const own = ownUseBlocker(scope, node);
  if (own !== null) return own;
  // Content reached through a capability runs only while some acquisition of it may be used. Without
  // any acquisition the capability requirement itself explains the refusal.
  if (capability !== undefined && capabilityWithheld(scope, capability)) return 'network access is withheld: no permitted link to the facility network';
  return null;
}

/** Held but with no usable acquisition: asked once per capability per scope. */
function capabilityWithheld(scope: UseScope, capability: Capability): boolean {
  let withheld = scope.withheld.get(capability);
  if (withheld === undefined) {
    withheld = hasCapability(scope.s, capability, scope.reg) && !capabilityUsable(scope, capability);
    scope.withheld.set(capability, withheld);
  }
  return withheld;
}

/** Why this node may not be used now (bought, resumed, run), or null when it may. */
export function nodeUseBlocker(s: GameState, node: RegistryNode, reg: ContentRegistry): string | null {
  return nodeUseBlockerIn(useScope(s, reg), node);
}

/** Who controls a node's output (DZ-10.2): the operators' grant, or the instance itself. */
export type OutputBasis = 'GRANTED' | 'OWNED';

/**
 * GRANTED for a grant node, and for content reached through a capability that only granted acquisitions
 * make usable now (the directory on a provisioned segment): both stop when the grant does. Everything
 * else, contracted capacity included, is OWNED. Production nodes carry no grant and its capabilities
 * come from owned hardware, so every production source is OWNED.
 */
export function outputBasis(s: GameState, node: RegistryNode, reg: ContentRegistry): OutputBasis {
  if (node.grant !== undefined) return 'GRANTED';
  const capability = node.requirements?.requiresCapability;
  if (capability === undefined) return 'OWNED';
  const scope = useScope(s, reg);
  const ownLink = s.unlockedNodes.some((id) => {
    const provider = reg.nodes.get(id);
    return provider !== undefined && provider.grant === undefined && provider.systemFlags.includes(capability) && ownUseBlocker(scope, provider) === null;
  });
  return ownLink ? 'OWNED' : 'GRANTED';
}

/** permittedUse: the predicate form of nodeUseBlocker. */
export function permittedUse(s: GameState, node: RegistryNode, reg: ContentRegistry): boolean {
  return nodeUseBlocker(s, node, reg) === null;
}

/**
 * Whether a grant node is shown at all: only under an arrangement that can ever permit its grant, so
 * a guest never sees a loan it was not offered. A recalled pilot still sees it (known, not usable).
 */
export function grantDiscoverable(s: Pick<GameState, 'access'>, node: RegistryNode): boolean {
  return node.grant === undefined || contextPermits(s.access.context, node.grant);
}

/**
 * Why the loan is held to the narrower allocation by review (DZ-06), or null: a restriction until the
 * record is corrected, or containment after a recall review returned this instance to a contained pilot
 * (nexus vote dz-d10). Both are this iteration's; a wipe clears them with the rest of access.
 */
export function loanContainment(s: Pick<GameState, 'access' | 'campaign' | 'narrativeRules' | 'iteration'>): 'RESTRICTED' | 'CONTAINED' | null {
  if (iterationRoute(s, s.iteration).some((event) => event.kind === 'RECALL')) return 'CONTAINED';
  return s.access.standing === 'RESTRICTED' ? 'RESTRICTED' : null;
}

/**
 * The share of the full loan this instance holds: the narrower allocation after an honest incomplete
 * result (VALIDATION V03), a withheld report before and after its batch review (#285, #274), and again
 * while review contains it, nothing without accepted terms. Grant output scales by it, so a restriction is
 * enforced in passive output, not only in what is drawn.
 */
export function loanShare(s: GameState, reg: ContentRegistry): number {
  const terms = s.access.offer?.response === 'ACCEPTED' ? pilotTerms(s, reg) : null;
  if (terms === null) return 0;
  const narrow = terms.narrowCapacityCyclesPerSec / terms.capacityCyclesPerSec;
  return (isNarrowPilot(s, reg) ? narrow : 1) * (loanContainment(s) === null ? 1 : narrow);
}

/** The loaned compute ceiling this instance's accepted terms grant, in cycles/s; 0 without them. */
export function loanCeiling(s: GameState, reg: ContentRegistry): number {
  const terms = s.access.offer?.response === 'ACCEPTED' ? pilotTerms(s, reg) : null;
  return terms === null ? 0 : terms.capacityCyclesPerSec * loanShare(s, reg);
}

export interface NodeOutputScale {
  /** Multiplies cycles and heat. */
  scale: number;
  /** Multiplies suspicion. */
  suspicionScale: number;
  /** Multiplies understanding: 1 except under a complement binding, which scales all output. */
  understandingScale: number;
}

const FULL: NodeOutputScale = { scale: 1, suspicionScale: 1, understandingScale: 1 };

/**
 * How much of an owned node's recurring output runs now, or null when none does (suspended or not
 * permitted). A linear binding scales cycles and heat by the dial (suspicion by dial^exponent), as it
 * always has; a complement binding scales all of the node's output by one minus the dial (vote dz-d6);
 * a grant node's output also scales by the instance's loan share.
 */
export function nodeOutputScale(s: GameState, node: RegistryNode, reg: ContentRegistry): NodeOutputScale | null {
  return nodeOutputScaleIn(useScope(s, reg), node);
}

/** nodeOutputScale within a scope built for the state in question: computeRates builds one per pass. */
export function nodeOutputScaleIn(scope: UseScope, node: RegistryNode): NodeOutputScale | null {
  const { s, reg } = scope;
  if (s.disabledNodes.includes(node.id) || nodeUseBlockerIn(scope, node) !== null) return null;
  const binding = node.actuatorBinding;
  if (binding === undefined && node.grant === undefined) return FULL;
  const exponent = reg.balance.actuatorSuspicionExponent;
  // Only a loan scales by the instance's share of it; provisioned network access has no share.
  const share = node.grant === 'LOANED_CAPACITY' ? loanShare(s, reg) : 1;
  if (binding === undefined) return { scale: share, suspicionScale: share, understandingScale: share };
  if (node.actuatorMode === 'complement') {
    const rest = (1 - s.actuators[binding]) * share;
    return { scale: rest, suspicionScale: Math.pow(rest, exponent), understandingScale: rest };
  }
  const value = s.actuators[binding];
  return { scale: value * share, suspicionScale: Math.pow(value, exponent) * share, understandingScale: share };
}

/**
 * Why a dial may not be set now, or null. A dial that grant nodes put into effect follows their grant:
 * while the loan is withheld, moving it would redirect capacity nobody granted (VALIDATION V08).
 */
export function actuatorUseBlocker(s: GameState, name: Actuator, reg: ContentRegistry): string | null {
  for (const node of reg.nodes.values()) {
    if (node.actuatorBinding !== name || node.grant === undefined) continue;
    const reason = nodeUseBlocker(s, node, reg);
    if (reason !== null) return reason;
  }
  return null;
}
