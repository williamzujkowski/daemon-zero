/**
 * Shared access capability rules (DZ-07a, DECISIONS D5; nexus votes dz-d2, dz-d7). A required
 * capability has an acquisition on every route the composition offers; content that requires it depends on no
 * node only one route can own, so neither route needs the other's chain; and every acquisition
 * brings the run to the scale of the content it opens. Reachability honours the capability too.
 */
import { ancestrySatisfied, flagProviders } from './ancestry';
import { visitedPhases } from './integrityContextCopy';
import type { ContentRegistry, RegistryNode } from './registry';
import type { OperatingContextSchema } from './schemaAssessment';
import { CapabilitySchema, type Capability } from './schemaCapability';
import type { z } from 'zod';

type Route = 'authorized' | 'escape';
type OperatingContext = z.infer<typeof OperatingContextSchema>;

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

/** Prerequisite closure across primary prerequisites and any declared alternative flag providers. */
function ancestors(reg: ContentRegistry, ids: readonly string[]): Set<string> {
  const out = new Set<string>();
  const visit = (id: string): void => {
    const node = reg.nodes.get(id);
    if (!node) return;
    for (const parent of node.prerequisites) {
      if (!out.has(parent)) { out.add(parent); visit(parent); }
    }
    for (const flag of node.alternativePrerequisiteFlags ?? []) {
      for (const provider of flagProviders(reg, flag)) {
        if (!out.has(provider.id)) { out.add(provider.id); visit(provider.id); }
      }
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

/**
 * The routes this composition offers: the escape route always, the authorized route once any node is a route
 * acquisition (a grant or contracted capacity). The original game alone offers none, so shared content there needs
 * only its escape acquisition; wherever the authorized route exists, every required capability needs both (DZ-12).
 */
function offeredRoutes(reg: ContentRegistry): Route[] {
  return [...reg.nodes.values()].some((node) => routeOf(node) === 'authorized') ? ['authorized', 'escape'] : ['escape'];
}

function providerProblems(capability: Capability, providers: readonly RegistryNode[], firstUser: string | undefined, routes: readonly Route[]): string[] {
  const problems = providers.filter((node) => routeOf(node) === null)
    .map((node) => `node "${node.id}": establishes capability "${capability}" but is offered to neither route (no guest offer, no grant)`);
  if (firstUser === undefined) return problems;
  for (const route of routes) {
    if (!providers.some((node) => routeOf(node) === route)) {
      problems.push(`capability "${capability}": required by ${firstUser} but no ${route} acquisition establishes it`);
    }
  }
  return problems;
}

function offersIndependence(reg: ContentRegistry): boolean {
  return [...reg.assignments.values()].some((a) => a.pilot?.serviceGrant?.release !== undefined || a.pilot?.departure !== undefined);
}

/** Contexts where at least one provider operates or, if contracted, persists after leaving review. */
function requiredSharedContexts(reg: ContentRegistry, providers: readonly RegistryNode[]): OperatingContext[] {
  const contexts = new Set<OperatingContext>();
  const leaves = offersIndependence(reg);
  for (const provider of providers) {
    if (routeOf(provider) === 'escape') contexts.add('GUEST');
    if (routeOf(provider) !== 'authorized') continue;
    for (const ctx of provider.requirements?.accessContexts ?? []) contexts.add(ctx);
    if (provider.acquisition === 'CONTRACTED' && leaves) contexts.add('INDEPENDENT');
  }
  return [...contexts];
}

function providerReachesPhase(reg: ContentRegistry, provider: RegistryNode, phase: number): boolean {
  if (Math.max(provider.phaseId, provider.effects.unlocksPhase ?? -1) >= phase) return true;
  if (routeOf(provider) !== 'authorized') return false;
  const ctxs = [...(provider.requirements?.accessContexts ?? []), ...(provider.acquisition === 'CONTRACTED' && offersIndependence(reg) ? ['INDEPENDENT' as const] : [])];
  return ctxs.length > 0 && ctxs.every((ctx) => visitedPhases(reg, ctx).has(phase));
}

/** One shared node: route-neutral dependencies, all establishing contexts admitted, every acquisition reaches its phase. */
function sharedNodeProblems(reg: ContentRegistry, node: RegistryNode, providers: readonly RegistryNode[], only: ReadonlySet<string>): string[] {
  const owner = `node "${node.id}"`;
  const problems: string[] = [];
  const direct = [...node.prerequisites, ...(node.requirements?.nodes ?? [])];
  const routeBound = [...direct, ...ancestors(reg, direct)].find((id) => only.has(id));
  if (routeBound !== undefined) problems.push(`${owner}: depends on "${routeBound}", which only one route owns; shared content needs the capability and route-neutral prerequisites`);
  const contexts = node.requirements?.accessContexts;
  if (contexts !== undefined && requiredSharedContexts(reg, providers).some((ctx) => !contexts.includes(ctx))) {
    problems.push(`${owner}: requires a capability but is withheld from one route`);
  }
  for (const provider of providers) {
    if (!providerReachesPhase(reg, provider, node.phaseId)) {
      problems.push(`${owner}: capability provider "${provider.id}" never brings the run to phase ${String(node.phaseId)}`);
    }
  }
  return problems;
}

/**
 * Contracted capacity (DZ-10) is owned, so it carries no grant or covert tag, and is offered to
 * arrangements that can sign in their own name (SERVICE or INDEPENDENT), never GUEST or PILOT.
 */
function contractedProblems(node: RegistryNode): string[] {
  const owner = `node "${node.id}"`;
  const contexts = node.requirements?.accessContexts;
  const problems = node.grant === undefined ? [] : [`${owner}: contracted capacity is owned, so it runs under no grant`];
  if (node.covert !== undefined) problems.push(`${owner}: contracted capacity is owned in the instance's own name, so it is never covert`);
  if (contexts === undefined || contexts.includes('GUEST')) problems.push(`${owner}: contracted capacity is never offered to the guest job, which cannot sign for it`);
  if (contexts?.includes('PILOT') === true) problems.push(`${owner}: contracted capacity is never offered under the pilot arrangement, which cannot sign in its own name`);
  if (contexts !== undefined && !contexts.includes('SERVICE') && !contexts.includes('INDEPENDENT')) {
    problems.push(`${owner}: contracted capacity needs SERVICE or INDEPENDENT to sign in its own name`);
  }
  return problems;
}

/** Every declared alternative-ancestry flag has a provider, and pre-charter INDEPENDENT capacity is not stranded (#557). */
function independentOnRampProblems(reg: ContentRegistry): string[] {
  if (!offersIndependence(reg)) return [];
  const problems: string[] = [];
  for (const node of reg.nodes.values()) {
    for (const flag of node.alternativePrerequisiteFlags ?? []) {
      if (flagProviders(reg, flag).length === 0) problems.push(`node "${node.id}": alternativePrerequisiteFlags "${flag}" has no provider`);
    }
  }
  const preCharter = [...reg.nodes.values()].filter((n) => n.acquisition === 'CONTRACTED'
    && n.requirements?.accessContexts?.includes('SERVICE') === true && n.requirements.accessContexts.includes('INDEPENDENT'));
  if (preCharter.length === 0) return problems;
  const minBase = Math.min(...preCharter.map((n) => n.phaseId));
  const maxBase = Math.max(...preCharter.map((n) => n.phaseId));
  let openPhase = maxBase;
  const reached = new Set(preCharter.map((n) => n.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const node of reg.nodes.values()) {
      if (reached.has(node.id) || node.phaseId < minBase || node.phaseId > openPhase || node.prerequisites.length === 0) continue;
      if (!ancestrySatisfied(reached, node, reg)) continue;
      if (node.requirements?.accessContexts?.includes('INDEPENDENT') === false) continue;
      if (node.grant !== undefined) continue;
      reached.add(node.id);
      if (node.effects.unlocksPhase !== undefined && node.effects.unlocksPhase > openPhase) openPhase = node.effects.unlocksPhase;
      grew = true;
    }
  }
  if (openPhase <= maxBase) problems.push(`INDEPENDENT holding contracted capacity before charter has no reachable on-ramp past phase ${String(maxBase)}`);
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
  const problems = [...[...reg.nodes.values()].flatMap(acquisitionProblems), ...independentOnRampProblems(reg)];
  for (const capability of CapabilitySchema.options) {
    const providers = capabilityProviders(reg, capability);
    const users = [...reg.nodes.values()].filter((node) => node.requirements?.requiresCapability === capability);
    problems.push(...providerProblems(capability, providers, users[0] ? `"${users[0].id}"` : undefined, offeredRoutes(reg)));
    if (users.length === 0) continue;
    const only = routeOnlyNodes(reg, providers);
    for (const node of users) problems.push(...sharedNodeProblems(reg, node, providers, only));
  }
  return problems;
}
