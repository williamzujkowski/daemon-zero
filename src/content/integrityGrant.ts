/**
 * Grant-tagged output and the pilot loop (DZ-05, DECISIONS D2, D7; nexus vote dz-d6). A grant node is
 * loaned recurring output only: it adds no capacity, scale or ending, it is bought only under an
 * arrangement that can grant it, and its dial is shared with no ungranted node. A pilot's service
 * names one such node whose complement binding carries study, so the split is one dial.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import type { PilotTerms } from './schemaPilot';

/** One-shot or scale effects a loan must never carry: revoking it could not take them back. */
function effectProblems(owner: string, node: RegistryNode): string[] {
  const fx = node.effects;
  const problems: string[] = [];
  if ((fx.memoryCapIncrease ?? 0) > 0) problems.push(`${owner}: a grant node carries no memoryCapIncrease`);
  // The pilot stays at its actual scale (nexus vote dz-d7): a loan never moves the phase or ends the run.
  if (fx.unlocksPhase !== undefined || fx.triggersVictory === true || fx.forcesEnding !== undefined) problems.push(`${owner}: a grant node never changes scale or ends the run`);
  if ((fx.knowledgeRetentionRatio ?? 0) > 0 || (fx.suspicionOnUnlock ?? 0) > 0 || node.systemFlags.length > 0) problems.push(`${owner}: a grant node changes only tagged recurring output`);
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
