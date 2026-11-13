/** Shared reference validation for declarative requirements in every content surface. */
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';

export function checkRequirements(reg: ContentRegistry, owner: string, req: Requirements | undefined): string[] {
  if (!req) return [];
  const problems: string[] = [];
  if (req.phaseAtLeast !== undefined && !reg.phases.some((phase) => phase.phaseId === req.phaseAtLeast)) problems.push(`${owner}: unknown required phase ${String(req.phaseAtLeast)}`);
  for (const id of [...(req.resolvedDilemmas ?? []), ...(req.forbidsResolvedDilemmas ?? [])]) if (!reg.dilemmas.some((dilemma) => dilemma.id === id)) problems.push(`${owner}: unknown required dilemma ${id}`);
  for (const id of [...(req.nodes ?? []), ...(req.forbidsNodes ?? [])]) {
    if (!reg.nodes.has(id)) problems.push(`${owner}: requirement references unknown node "${id}"`);
  }
  if (req.minIteration !== undefined && req.maxIteration !== undefined && req.maxIteration < req.minIteration) {
    problems.push(`${owner}: maxIteration is below minIteration`);
  }
  for (const id of Object.keys(req.minTrust ?? {})) {
    if (!reg.factions.has(id)) problems.push(`${owner}: requirement references unknown faction "${id}"`);
  }
  return problems;
}

