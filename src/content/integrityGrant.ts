/**
 * Grant-tagged output and the pilot loop (DZ-05, DECISIONS D2, D7; nexus vote dz-d6). A grant node is
 * granted recurring output only: it adds no capacity, scale or ending (provisioned network access may
 * open network scale, DZ-07a), it is bought only under an arrangement that can grant it, and its dial is
 * shared with no ungranted node. A pilot's service
 * names one such node whose complement binding carries study, so the split is one dial.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import type { PilotTerms } from './schemaPilot';
import { CapabilitySchema } from './schemaCapability';

const CAPABILITIES: readonly string[] = CapabilitySchema.options;

/**
 * One-shot or scale effects a grant must never carry: revoking it could not take them back. The one
 * exception is the authorized network substrate (nexus vote dz-d7): provisioned access opens network
 * scale directly and establishes the shared access capability, and owns no memory. A loan never
 * moves the phase: the pilot stays at its actual scale.
 */
function effectProblems(owner: string, node: RegistryNode): string[] {
  const fx = node.effects;
  const substrate = node.grant === 'AUTHORIZED_NETWORK';
  const problems: string[] = [];
  if ((fx.memoryCapIncrease ?? 0) > 0) problems.push(`${owner}: a grant node carries no memoryCapIncrease`);
  if ((fx.unlocksPhase !== undefined && !substrate) || fx.triggersVictory === true || fx.forcesEnding !== undefined) problems.push(`${owner}: a grant node never changes scale or ends the run`);
  const flags = node.systemFlags.filter((flag) => !substrate || !CAPABILITIES.includes(flag));
  if ((fx.knowledgeRetentionRatio ?? 0) > 0 || (fx.suspicionOnUnlock ?? 0) > 0 || flags.length > 0) problems.push(`${owner}: a grant node changes only tagged recurring output`);
  if (fx.unlocksPhase !== undefined && flags.length === node.systemFlags.length) problems.push(`${owner}: provisioned access that changes scale must establish a shared access capability`);
  return problems;
}

function grantNodeProblems(node: RegistryNode, reg: ContentRegistry): string[] {
  const owner = `node "${node.id}"`;
  const problems = node.grant === undefined ? [] : effectProblems(owner, node);
  if (node.actuatorMode !== undefined && node.actuatorBinding === undefined) problems.push(`${owner}: actuatorMode needs an actuatorBinding`);
  if (node.actuatorMode === 'complement' && node.grant === undefined) problems.push(`${owner}: a complement binding belongs to a grant node`);
  if (node.grant === undefined) return problems;
  // Stopping must be possible without hardware rules in the way, and buying needs the arrangement.
  if (!node.suspendable) problems.push(`${owner}: a grant node must be suspendable software`);
  const contexts = node.requirements?.accessContexts ?? [];
  if (contexts.length === 0 || contexts.includes('GUEST') || contexts.includes('INDEPENDENT')) problems.push(`${owner}: a grant node is offered only under a reviewed arrangement`);
  const binding = node.actuatorBinding;
  const shared = binding === undefined ? [] : [...reg.nodes.values()].filter((other) => other.actuatorBinding === binding && other.grant !== node.grant);
  if (shared.length > 0) problems.push(`${owner}: its dial is also bound by "${shared[0]?.id ?? ''}", which runs under a different grant`);
  return problems;
}

function serviceProblems(assignmentId: string, terms: PilotTerms, reg: ContentRegistry): string[] {
  const service = terms.service;
  if (service === undefined) return [];
  const owner = `assignment "${assignmentId}" pilot service`;
  const node = reg.nodes.get(service.node);
  if (!node) return [`${owner}: names unknown node "${service.node}"`];
  const problems: string[] = [];
  if (node.grant !== 'LOANED_CAPACITY') problems.push(`${owner}: node "${node.id}" must run on loaned capacity`);
  if (node.actuatorBinding !== 'serviceAllocationRatio' || node.actuatorMode !== 'complement') problems.push(`${owner}: node "${node.id}" must carry study on a complement binding of serviceAllocationRatio`);
  if (node.tickDelta.understandingPerSec <= 0) problems.push(`${owner}: node "${node.id}" must produce study output`);
  return problems;
}

/** Every grant node, binding mode and pilot service holds together. */
export function checkGrantIntegrity(reg: ContentRegistry): string[] {
  const problems = [...reg.nodes.values()].flatMap((node) => grantNodeProblems(node, reg));
  for (const [id, assignment] of reg.assignments) if (assignment.pilot) problems.push(...serviceProblems(id, assignment.pilot, reg));
  return problems;
}
