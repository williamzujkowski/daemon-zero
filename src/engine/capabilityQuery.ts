/**
 * The shared access capability (DZ-07a, nexus vote dz-d2): whether this instance holds it, and the
 * load checks that keep acquisitions honest. Capability is substrate: an owned node, active or
 * suspended, that establishes it. Whether that substrate may be used is the access record's question.
 */
import type { ContentRegistry } from '../content/registry';
import type { Requirements } from '../content/schema';
import type { Capability } from '../content/schemaCapability';
import { contextPermits, iterationRoute, routeTarget } from './accessQuery';
import type { OperatingContext } from './accessState';
import type { GameState } from './state';

/** True while some owned node (active or suspended) establishes the capability. */
export function hasCapability(s: Pick<GameState, 'unlockedNodes'>, capability: Capability, reg: ContentRegistry): boolean {
  return s.unlockedNodes.some((id) => reg.nodes.get(id)?.systemFlags.includes(capability) === true);
}

/** Whether a requirement set's capability gate is met. Without a registry no capability can be shown. */
export function meetsCapability(s: Pick<GameState, 'unlockedNodes'>, req: Requirements | undefined, reg?: ContentRegistry): boolean {
  const capability = req?.requiresCapability;
  return capability === undefined || (reg !== undefined && hasCapability(s, capability, reg));
}

/** The arrangements this iteration has actually been in, from the guest job through its route events. */
function contextsThisIteration(s: GameState): OperatingContext[] {
  const contexts: OperatingContext[] = ['GUEST'];
  for (const event of iterationRoute(s, s.iteration)) {
    const next = routeTarget(contexts.at(-1) ?? 'GUEST', event.kind);
    if (next !== null) contexts.push(next);
  }
  return contexts;
}

/**
 * Why a save's acquisitions could not have happened, or null. Loading refuses rather than heals: a
 * node reached through a capability it does not hold, or granted capacity no arrangement of this
 * iteration permitted, would need the other route's history or a grant nobody gave (DECISIONS D5).
 * Reconciliation never restores a capability's provider, since that would choose a route for the save.
 */
export function capabilityProblem(s: GameState, reg: ContentRegistry): string | null {
  for (const id of s.unlockedNodes) {
    const node = reg.nodes.get(id);
    if (node && !meetsCapability(s, node.requirements, reg)) return 'save owns shared hardware without the access capability that reaches it';
  }
  const contexts = contextsThisIteration(s);
  for (const id of s.unlockedNodes) {
    const grant = reg.nodes.get(id)?.grant;
    if (grant !== undefined && !contexts.some((context) => contextPermits(context, grant))) return 'save owns granted capacity that no arrangement of this iteration permitted';
  }
  return null;
}
