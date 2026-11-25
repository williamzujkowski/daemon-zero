/**
 * Shared prerequisite & alternative-ancestry helpers (#557): a node can be anchored either through all of
 * its declared `prerequisites` (the primary branch) OR through an owned node establishing one of its
 * declared `alternativePrerequisiteFlags` (the off-books on-ramp). Shared by the engine and integrity checks
 * so reachability, save restoration, UI hints and fallback rules read the same graph without naming ids.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import type { SystemFlag } from './schema';

type NodeLookup = Pick<ContentRegistry, 'nodes'>;
type Owned = ReadonlySet<string> | readonly string[];

function contains(owned: Owned, id: string): boolean {
  return Array.isArray(owned) ? owned.includes(id) : (owned as ReadonlySet<string>).has(id);
}

/** Nodes in `reg` whose systemFlags establish `flag`. */
export function flagProviders(reg: NodeLookup, flag: SystemFlag): RegistryNode[] {
  return [...reg.nodes.values()].filter((node) => node.systemFlags.includes(flag));
}

/** Owned provider id satisfying any declared `alternativePrerequisiteFlags` of `node`, or null. */
export function matchingAlternativeProvider(owned: Owned, node: Pick<RegistryNode, 'alternativePrerequisiteFlags'>, reg?: NodeLookup): string | null {
  const flags = node.alternativePrerequisiteFlags;
  if (flags === undefined || reg === undefined) return null;
  const list = Array.isArray(owned) ? (owned as readonly string[]) : [...(owned as ReadonlySet<string>)];
  for (const id of list) {
    const provider = reg.nodes.get(id);
    if (provider !== undefined && flags.some((flag) => provider.systemFlags.includes(flag))) return id;
  }
  return null;
}

/** Whether `owned` satisfies `node`'s direct ancestry (`prerequisites` OR any `alternativePrerequisiteFlags`). */
export function ancestrySatisfied(
  owned: Owned,
  node: Pick<RegistryNode, 'prerequisites' | 'alternativePrerequisiteFlags'>,
  reg?: NodeLookup,
): boolean {
  if (node.prerequisites.every((id) => contains(owned, id))) return true;
  return matchingAlternativeProvider(owned, node, reg) !== null;
}

/** Direct parent groups that each independently establish `node`'s structural ancestry. */
export function ancestryBranches(reg: NodeLookup, node: Pick<RegistryNode, 'prerequisites' | 'alternativePrerequisiteFlags'>): RegistryNode[][] {
  const primary = node.prerequisites.flatMap((id) => {
    const parent = reg.nodes.get(id);
    return parent ? [parent] : [];
  });
  const flags = node.alternativePrerequisiteFlags;
  if (flags === undefined) return [primary];
  const seen = new Set<string>();
  const alts = flags.flatMap((flag) => flagProviders(reg, flag))
    .filter((provider) => (seen.has(provider.id) ? false : (seen.add(provider.id), true)))
    .map((provider) => [provider]);
  return [primary, ...alts];
}
