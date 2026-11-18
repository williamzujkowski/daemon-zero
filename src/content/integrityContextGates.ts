/**
 * Context gates at network scale (DZ-07b, DECISIONS D5, D6). A scene, action or encounter an authorized
 * arrangement could structurally meet at a scale it is provisioned for must say which arrangements it is
 * truthful under; wording for "inside the box" excludes every network acquisition, not one route's; and
 * permitted output (a grant, or content reached through the shared capability) never feeds rogue suspicion.
 */
import { escapeOnlyNodes, capabilityProviders } from './integrityCapability';
import { REVIEWED_CONTEXTS, visitedPhases } from './integrityContextCopy';
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';
import { CapabilitySchema } from './schemaCapability';

interface Gated {
  owner: string;
  /** The scale the item belongs to: its own phase or the highest phase its gate names. */
  phase: number;
  req: Requirements;
  /**
   * A follow-up's access means, one of which must hold besides `req`. A follow-up's trigger reads no
   * access (integrityFollowUp), so each means declares its own arrangements instead.
   */
  means: readonly Requirements[];
}

function gatePhase(reg: ContentRegistry, req: Requirements, own = 0): number {
  const nodePhases = (req.nodes ?? []).map((id) => reg.nodes.get(id)?.phaseId ?? 0);
  return Math.max(own, req.phaseAtLeast ?? 0, ...nodePhases);
}

function gatedItems(reg: ContentRegistry): Gated[] {
  const item = (owner: string, req: Requirements, own = 0, means: readonly Requirements[] = []): Gated =>
    ({ owner, phase: gatePhase(reg, req, own), req, means });
  return [
    ...reg.dilemmas.map((d) => item(`dilemma "${d.id}"`, d.trigger, d.phaseId, d.followUp?.access.map((access) => access.requirements) ?? [])),
    ...[...reg.actions.values()].map((action) => item(`action "${action.id}"`, action.requirements)),
    ...reg.swarm.playerSwarmTemplates.map((template) => item(`swarm template "${template.id}"`, template.requirements)),
    ...reg.swarm.wildShardEncounters.map((encounter) => item(`wild encounter "${encounter.id}"`, encounter.requirements)),
    ...reg.swarm.channelEncounters.map((encounter) => item(`channel encounter "${encounter.id}"`, encounter.requirements)),
  ];
}

/** The highest scale any reviewed arrangement is provisioned for. */
function provisionedScale(reg: ContentRegistry): number {
  return Math.max(...REVIEWED_CONTEXTS.flatMap((context) => [...visitedPhases(reg, context)]));
}

/** Needs a node only the escape route owns, or declares the arrangements it is truthful under. */
function settled(req: Requirements, escapeOnly: ReadonlySet<string>): boolean {
  return req.accessContexts !== undefined || (req.nodes ?? []).some((id) => escapeOnly.has(id));
}

/** Settled by its gate, or, for a follow-up, by every access means. */
function declared(item: Gated, escapeOnly: ReadonlySet<string>): boolean {
  if (settled(item.req, escapeOnly)) return true;
  return item.means.length > 0 && item.means.every((means) => settled(means, escapeOnly));
}

function undeclaredGates(reg: ContentRegistry): string[] {
  const opening = reg.phases[0]?.phaseId ?? 0;
  const scale = provisionedScale(reg);
  if (scale <= opening) return [];
  const escapeOnly = escapeOnlyNodes(reg);
  return gatedItems(reg)
    .filter((item) => item.phase > opening && item.phase <= scale && !declared(item, escapeOnly))
    .map((item) => `${item.owner}: an authorized arrangement can meet it at network scale, so it must declare accessContexts`);
}

/** Every requirement surface that can forbid a node. */
function forbidSurfaces(reg: ContentRegistry): { owner: string; req: Requirements | undefined }[] {
  return [
    ...[...reg.nodes.values()].map((node) => ({ owner: `node "${node.id}"`, req: node.requirements })),
    ...reg.dilemmas.map((d) => ({ owner: `dilemma "${d.id}"`, req: d.trigger })),
    ...[...reg.actions.values()].map((action) => ({ owner: `action "${action.id}"`, req: action.requirements })),
    ...reg.routines.map((routine) => ({ owner: `routine "${routine.id}"`, req: routine.requirements })),
    ...reg.swarm.channelEncounters.map((encounter) => ({ owner: `channel encounter "${encounter.id}"`, req: encounter.requirements })),
    ...reg.narrative.ambientChatter.map((line) => ({ owner: `ambient line "${line.id}"`, req: line.requirements })),
  ];
}

/** Forbidding one acquisition of a capability means "without that access", so it forbids all of them. */
function partialForbids(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const capability of CapabilitySchema.options) {
    const providers = capabilityProviders(reg, capability).map((node) => node.id);
    for (const { owner, req } of forbidSurfaces(reg)) {
      const forbidden = req?.forbidsNodes ?? [];
      const missing = providers.filter((id) => !forbidden.includes(id));
      if (missing.length > 0 && missing.length < providers.length) problems.push(`${owner}: forbids one acquisition of ${capability} but not "${missing.join('", "')}"`);
    }
  }
  return problems;
}

/** Permitted output is review's business, never rogue suspicion (DECISIONS D6). */
function permittedSuspicion(reg: ContentRegistry): string[] {
  return [...reg.nodes.values()]
    .filter((node) => node.grant !== undefined || node.requirements?.requiresCapability !== undefined)
    .filter((node) => node.tickDelta.suspicionPerSec > 0 || (node.effects.suspicionOnUnlock ?? 0) > 0)
    .map((node) => `node "${node.id}": permitted output (a grant or shared content) carries no positive suspicion`);
}

export function checkContextGateIntegrity(reg: ContentRegistry): string[] {
  return [...undeclaredGates(reg), ...partialForbids(reg), ...permittedSuspicion(reg)];
}
