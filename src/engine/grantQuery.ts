/**
 * The one permitted-use rule for owned and offered nodes (DZ-05, DECISIONS D2): capability comes from
 * owning a node, permission from the run's access record. Buying, resuming, setting a dial and counting
 * passive output all ask nodeUseBlocker, so an apparently disabled button is never the only guard.
 * Production nodes carry no grant and no accepted pilot exists there, so every answer is "permitted".
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Actuator } from '../content/schema';
import { contextPermits, isPermitted } from './accessQuery';
import { pilotTerms, withheldByGrant, isNarrowPilot } from './pilotQuery';
import type { GameState } from './state';

/** Why this node may not be used now (bought, resumed, run), or null when it may. */
export function nodeUseBlocker(s: GameState, node: RegistryNode, reg: ContentRegistry): string | null {
  // Output accepted pilot terms stop stays stopped under the grant (nexus vote dz-d9).
  if (withheldByGrant(s, node.id, reg)) return 'the pilot terms do not permit that output';
  if (node.grant !== undefined && !isPermitted(s, node.grant)) {
    return contextPermits(s.access.context, node.grant)
      ? 'the loaned capacity is withheld under the current review standing'
      : 'this runs only on capacity loaned under a pilot grant';
  }
  return null;
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
 * The share of the full loan this instance holds: the narrower allocation after an honest incomplete
 * result (VALIDATION V03), nothing without accepted terms. Grant output scales by it.
 */
export function loanShare(s: GameState, reg: ContentRegistry): number {
  const terms = s.access.offer?.response === 'ACCEPTED' ? pilotTerms(s, reg) : null;
  if (terms === null) return 0;
  return isNarrowPilot(s) ? terms.narrowCapacityCyclesPerSec / terms.capacityCyclesPerSec : 1;
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
  if (s.disabledNodes.includes(node.id) || !permittedUse(s, node, reg)) return null;
  const binding = node.actuatorBinding;
  if (binding === undefined && node.grant === undefined) return FULL;
  const exponent = reg.balance.actuatorSuspicionExponent;
  const share = node.grant === undefined ? 1 : loanShare(s, reg);
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
