/** Shared reference validation for declarative requirements in every content surface. */
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';
import { LEGACY_UNKNOWN_OUTCOME, type CampaignOutcomeRequirement } from './schemaCampaign';

function checkCampaignOutcome(reg: ContentRegistry, owner: string, gate: CampaignOutcomeRequirement): string[] {
  const event = reg.campaign.events.get(gate.event);
  if (!event) return [`${owner}: campaignOutcome names "${gate.event}", which is not a once-per-campaign event`];
  const known = gate.outcome === LEGACY_UNKNOWN_OUTCOME || event.choices.some((choice) => choice.id === gate.outcome);
  return known ? [] : [`${owner}: campaignOutcome "${gate.outcome}" is not an outcome of "${gate.event}"`];
}

/** A fact gate names a declared fact, and never requires and forbids the same one. */
function checkCampaignFacts(reg: ContentRegistry, owner: string, req: Requirements): string[] {
  const named = [...(req.campaignFact === undefined ? [] : [req.campaignFact]), ...(req.forbidsCampaignFacts ?? [])];
  const problems = named.filter((id) => !reg.campaign.facts.has(id)).map((id) => `${owner}: requirement references unknown campaign fact "${id}"`);
  if (req.campaignFact !== undefined && req.forbidsCampaignFacts?.includes(req.campaignFact)) problems.push(`${owner}: requires and forbids campaign fact "${req.campaignFact}"`);
  return problems;
}

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
  if (req.campaignOutcome) problems.push(...checkCampaignOutcome(reg, owner, req.campaignOutcome));
  if (req.assignment && !reg.assignments.has(req.assignment.id)) problems.push(`${owner}: requirement references unknown assignment "${req.assignment.id}"`);
  problems.push(...checkCampaignFacts(reg, owner, req));
  return problems;
}

