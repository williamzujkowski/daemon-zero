/**
 * Variant endings refine a trait family without changing the family's dominance or tie-break. A forced ending (a node's
 * forcesEnding) that states evidence in its requirements is reached only through gates that already prove it (#486), so
 * its epilogue can never be told to a record it is not true of; every ending's stated claims are proven the same way
 * (#466, integrityEndingClaims.ts).
 */
import { checkEndingClaims, checkFuturePlaceholders } from './integrityEndingClaims';
import type { ContentRegistry, RegistryNode } from './registry';
import type { Requirements } from './schema';

export function checkEndingVariants(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const ending of reg.endings) {
    if (ending.variantOf === undefined) continue;
    const parent = reg.endings.find((entry) => entry.id === ending.variantOf);
    if (!parent || parent.forcedOnly || parent.variantOf !== undefined || ending.forcedOnly) problems.push(`${ending.id}: invalid ending variant parent`);
    if (!ending.requirements) problems.push(`${ending.id}: ending variant requires gates`);
    if (ending.requirements?.requiredNarrativeFlag && !reg.swarm.narrativeFlags.includes(ending.requirements.requiredNarrativeFlag)) problems.push(`${ending.id}: unknown narrative flag`);
    if (parent && ending.dominantTraits.join() !== parent.dominantTraits.join()) problems.push(`${ending.id}: variant must keep parent traits`);
    if (reg.endings.some((other) => other.id !== ending.id && other.variantOf === ending.variantOf && other.priority === ending.priority)) problems.push(`${ending.id}: variant priorities must be unique within a family`);
  }
  return [...problems, ...checkForcedEvidence(reg), ...checkEndingClaims(reg, unproven), ...checkFuturePlaceholders(reg)];
}

/** Every node a purchase of `node` implies is owned: itself, what it names in `nodes`, and its prerequisites, transitively. */
function impliedNodes(reg: ContentRegistry, node: RegistryNode): Set<string> {
  const owned = new Set<string>(), pending = [node.id, ...(node.requirements?.nodes ?? [])];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (owned.has(id)) continue;
    owned.add(id);
    pending.push(...(reg.nodes.get(id)?.prerequisites ?? []));
  }
  return owned;
}

/** The ending's requirement keys this rule can prove from a node's own gates; any other key is refused as unprovable. */
const PROVABLE: ReadonlySet<keyof Requirements> = new Set(['phaseAtLeast', 'requiredNarrativeFlag', 'nodes', 'forbidsNodes']);

function unproven(reg: ContentRegistry, node: RegistryNode, evidence: Requirements): string[] {
  const gates = node.requirements ?? {}, owned = impliedNodes(reg, node), missing: string[] = [];
  for (const key of Object.keys(evidence) as (keyof Requirements)[]) if (!PROVABLE.has(key)) missing.push(`${key} cannot be proven from a node's gates`);
  if ((evidence.phaseAtLeast ?? 0) > node.phaseId) missing.push(`phaseAtLeast ${String(evidence.phaseAtLeast)}`);
  if (evidence.requiredNarrativeFlag !== undefined && evidence.requiredNarrativeFlag !== gates.requiredNarrativeFlag) missing.push(`flag "${evidence.requiredNarrativeFlag}"`);
  for (const id of evidence.nodes ?? []) if (!owned.has(id)) missing.push(`node "${id}"`);
  for (const id of evidence.forbidsNodes ?? []) if (!(gates.forbidsNodes ?? []).includes(id)) missing.push(`the absence of node "${id}"`);
  return missing;
}

function checkForcedEvidence(reg: ContentRegistry): string[] {
  return [...reg.nodes.values()].flatMap((node) => {
    const ending = reg.endings.find((entry) => entry.id === node.effects.forcesEnding);
    if (ending?.requirements === undefined) return [];
    return unproven(reg, node, ending.requirements).map((what) => `node "${node.id}": forces ending ${ending.id}, but its gates do not prove ${what}`);
  });
}
