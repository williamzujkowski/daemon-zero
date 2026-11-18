/** Shared reference validation for declarative requirements in every content surface. */
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';
import { INTERRUPTED_FACT_OUTCOME, LEGACY_UNKNOWN_OUTCOME, type CampaignOutcomeRequirement } from './schemaCampaign';

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

/**
 * Nexus vote nh-d9: a trait fallback stands in only where history cannot answer, so its fact must
 * be declared and may hold only for an unrecorded outcome. A fact that could hold for a chosen
 * branch would let trait history override a known fate.
 */
function checkTraitFallback(reg: ContentRegistry, owner: string, req: Requirements): string[] {
  if (!req.traitFallback) return [];
  const fact = reg.campaign.facts.get(req.traitFallback.whileFact);
  if (!fact) return [`${owner}: traitFallback names unknown campaign fact "${req.traitFallback.whileFact}"`];
  const known = fact.outcomes.filter((outcome) => outcome !== LEGACY_UNKNOWN_OUTCOME && outcome !== INTERRUPTED_FACT_OUTCOME);
  return known.length > 0 ? [`${owner}: traitFallback fact "${fact.id}" holds for a recorded choice (${known.join(', ')})`] : [];
}

/**
 * Nexus vote nh-d7: an obligation is a consequential or follow-up event with a campaign record, so
 * completion can outlive the iteration; a review completes an obligation, it is never one. An
 * inherited-fact gate distinguishes who saw a chosen branch, so its fact names choices only.
 */
function checkCampaignHistoryGates(reg: ContentRegistry, owner: string, req: Requirements): string[] {
  const problems: string[] = [];
  for (const id of req.campaignObligations ?? []) {
    const eventClass = reg.campaign.events.get(id)?.campaign?.eventClass;
    if (eventClass !== 'consequential' && eventClass !== 'follow_up') problems.push(`${owner}: campaign obligation "${id}" is not a consequential once-per-campaign event`);
  }
  for (const id of req.forbidsInheritedFacts ?? []) {
    const fact = reg.campaign.facts.get(id);
    if (!fact) problems.push(`${owner}: requirement references unknown campaign fact "${id}"`);
    else if (fact.outcomes.some((outcome) => outcome === LEGACY_UNKNOWN_OUTCOME || outcome === INTERRUPTED_FACT_OUTCOME)) {
      problems.push(`${owner}: inherited fact "${id}" must name chosen outcomes only`);
    }
  }
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
  if (req.accessContexts && new Set(req.accessContexts).size !== req.accessContexts.length) problems.push(`${owner}: accessContexts lists an arrangement twice`);
  if (req.reviewStandings && new Set(req.reviewStandings).size !== req.reviewStandings.length) problems.push(`${owner}: reviewStandings lists a standing twice`);
  problems.push(...checkCampaignFacts(reg, owner, req));
  problems.push(...checkTraitFallback(reg, owner, req));
  problems.push(...checkCampaignHistoryGates(reg, owner, req));
  return problems;
}

