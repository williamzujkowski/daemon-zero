/**
 * Shared access capability rules (DZ-07a, DECISIONS D5; nexus votes dz-d2, dz-d7). A required
 * capability has an authorized and an escape acquisition; content that requires it depends on no
 * node only one route can own, so neither route needs the other's chain; and every acquisition
 * brings the run to the scale of the content it opens. Reachability honours the capability too.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import { CapabilitySchema, type Capability } from './schemaCapability';

type Route = 'authorized' | 'escape';

/** Nodes whose ownership establishes the capability. */
export function capabilityProviders(reg: ContentRegistry, capability: Capability): RegistryNode[] {
  return [...reg.nodes.values()].filter((node) => node.systemFlags.includes(capability));
}

/**
 * Whether a node's capability gate is met once `reached` is owned: no gate, or some provider is owned.
 * The integrity reachability sweep uses this, so a node only a missing capability unlocks is stuck.
 */
export function capabilityReached(reg: ContentRegistry, node: RegistryNode, reached: ReadonlySet<string>): boolean {
  const capability = node.requirements?.requiresCapability;
  return capability === undefined || capabilityProviders(reg, capability).some((provider) => reached.has(provider.id));
}

/**
 * Which route an acquisition belongs to. A grant node is authorized (integrityGrant keeps every grant
 * node to reviewed arrangements), and so is capacity contracted in the instance's own name (DZ-10),
 * which is never offered to the guest job; a node a guest can be offered without a grant is the escape route.
 */
function routeOf(node: RegistryNode): Route | null {
  if (node.grant !== undefined || node.acquisition === 'CONTRACTED') return 'authorized';
  const contexts = node.requirements?.accessContexts;
  return contexts === undefined || contexts.includes('GUEST') ? 'escape' : null;
}

/** The prerequisite closure of the given ids, not including them. */
function ancestors(reg: ContentRegistry, ids: readonly string[]): Set<string> {
  const out = new Set<string>();
  const visit = (id: string): void => {
    for (const parent of reg.nodes.get(id)?.prerequisites ?? []) {
      if (out.has(parent)) continue;
      out.add(parent);
      visit(parent);
    }
  };
  ids.forEach(visit);
  return out;
}

/**
 * Nodes only one route can own: each route's acquisitions and their ancestors, less the ancestors both
 * routes share, plus everything built on one of those. Shared content may depend on none of them.
 */
function routeOnlyNodes(reg: ContentRegistry, providers: readonly RegistryNode[], routes: readonly Route[] = ['authorized', 'escape']): Set<string> {
  const chain = (route: Route): Set<string> => {
    const ids = providers.filter((node) => routeOf(node) === route).map((node) => node.id);
    return new Set([...ids, ...ancestors(reg, ids)]);
  };
  const authorized = chain('authorized');
  const escape = chain('escape');
  const only = new Set([...(routes.includes('authorized') ? authorized : []), ...(routes.includes('escape') ? escape : [])]
    .filter((id) => !(authorized.has(id) && escape.has(id))));
  for (const node of reg.nodes.values()) if ([...ancestors(reg, [node.id])].some((id) => only.has(id))) only.add(node.id);
  return only;
}

/**
 * Nodes only the escape route can own, across every capability (DZ-07b): content gated on one of them
 * needs the escape chain, so an authorized arrangement never meets it without actually taking that chain.
 */
export function escapeOnlyNodes(reg: ContentRegistry): Set<string> {
  const providers = CapabilitySchema.options.flatMap((capability) => capabilityProviders(reg, capability));
  return routeOnlyNodes(reg, providers, ['escape']);
}

function providerProblems(capability: Capability, providers: readonly RegistryNode[], firstUser: string | undefined): string[] {
  const problems = providers.filter((node) => routeOf(node) === null)
    .map((node) => `node "${node.id}": establishes capability "${capability}" but is offered to neither route (no guest offer, no grant)`);
  if (firstUser === undefined) return problems;
  for (const route of ['authorized', 'escape'] as const) {
    if (!providers.some((node) => routeOf(node) === route)) {
      problems.push(`capability "${capability}": required by ${firstUser} but no ${route} acquisition establishes it`);
    }
  }
  return problems;
}

/** One shared node: route-neutral dependencies, both routes admitted, every acquisition reaches its phase. */
function sharedNodeProblems(reg: ContentRegistry, node: RegistryNode, providers: readonly RegistryNode[], only: ReadonlySet<string>): string[] {
  const owner = `node "${node.id}"`;
  const problems: string[] = [];
  const direct = [...node.prerequisites, ...(node.requirements?.nodes ?? [])];
  const routeBound = [...direct, ...ancestors(reg, direct)].find((id) => only.has(id));
  if (routeBound !== undefined) problems.push(`${owner}: depends on "${routeBound}", which only one route owns; shared content needs the capability and route-neutral prerequisites`);
  const contexts = node.requirements?.accessContexts;
  if (contexts !== undefined && !(contexts.includes('GUEST') && contexts.includes('SERVICE'))) problems.push(`${owner}: requires a capability but is withheld from one route`);
  for (const provider of providers) {
    if (Math.max(provider.phaseId, provider.effects.unlocksPhase ?? -1) < node.phaseId) {
      problems.push(`${owner}: capability provider "${provider.id}" never brings the run to phase ${String(node.phaseId)}`);
    }
  }
  return problems;
}

/**
 * Contracted capacity (DZ-10) is owned, so it carries no grant, and it needs an arrangement that can sign
 * for it: it is offered to named arrangements, never the guest job.
 */
function contractedProblems(node: RegistryNode): string[] {
  const owner = `node "${node.id}"`;
  const contexts = node.requirements?.accessContexts;
  const problems = node.grant === undefined ? [] : [`${owner}: contracted capacity is owned, so it runs under no grant`];
  if (contexts === undefined || contexts.includes('GUEST')) problems.push(`${owner}: contracted capacity is never offered to the guest job, which cannot sign for it`);
  return problems;
}

/** An unauthorized acquisition is never lawful capacity: no grant, and never offered only to a reviewed arrangement. */
function acquisitionProblems(node: RegistryNode): string[] {
  if (node.acquisition === 'CONTRACTED') return contractedProblems(node);
  if (node.acquisition !== 'UNAUTHORIZED') return [];
  const owner = `node "${node.id}"`;
  const contexts = node.requirements?.accessContexts;
  const problems = node.grant === undefined ? [] : [`${owner}: an unauthorized acquisition cannot run under a grant`];
  if (contexts !== undefined && !contexts.includes('GUEST') && !contexts.includes('INDEPENDENT')) problems.push(`${owner}: an unauthorized acquisition is offered only where it is forbidden`);
  return problems;
}

export function checkCapabilityIntegrity(reg: ContentRegistry): string[] {
  const problems = [...reg.nodes.values()].flatMap(acquisitionProblems);
  for (const capability of CapabilitySchema.options) {
    const providers = capabilityProviders(reg, capability);
    const users = [...reg.nodes.values()].filter((node) => node.requirements?.requiresCapability === capability);
    problems.push(...providerProblems(capability, providers, users[0] ? `"${users[0].id}"` : undefined));
    if (users.length === 0) continue;
    const only = routeOnlyNodes(reg, providers);
    for (const node of users) problems.push(...sharedNodeProblems(reg, node, providers, only));
  }
  return problems;
}
