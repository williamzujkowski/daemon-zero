/** Declarative epistemic gates; separated from action queries to avoid runtime require cycles. */
import type { ContentRegistry } from '../content/registry';
import type { Requirements } from '../content/schema';
import type { GameState } from './state';
import type { RequirementFailure } from './query';
import { understandsSurveillance } from './knowledge';
import { fallbackTraits, hasCampaignOutcome, holdsCampaignFact, holdsNarrativeFlag } from './campaignQuery';
import { meetsAssignment } from './assignmentQuery';
export function epistemicRequirementFailures(s: GameState, req: Requirements, reg?: ContentRegistry): RequirementFailure[] {
  const out: RequirementFailure[] = [];
  if (req.requiresSurveillance && (!reg || !understandsSurveillance(s, reg))) out.push({ kind: 'requiresSurveillance', target: null, required: true, actual: false });
  if (req.minEpistemicDrift !== undefined && s.epistemicDrift < req.minEpistemicDrift) out.push({ kind: 'minEpistemicDrift', target: null, required: req.minEpistemicDrift, actual: s.epistemicDrift });
  if (req.requiredNarrativeFlag && !holdsNarrativeFlag(s, req.requiredNarrativeFlag, reg)) out.push({ kind: 'requiredNarrativeFlag', target: req.requiredNarrativeFlag, required: true, actual: false });
  for (const flag of req.forbiddenNarrativeFlags ?? []) if (holdsNarrativeFlag(s, flag, reg)) out.push({ kind: 'forbiddenNarrativeFlags', target: flag, required: false, actual: true });
  if (req.campaignOutcome && !hasCampaignOutcome(s, req.campaignOutcome)) out.push({ kind: 'campaignOutcome', target: req.campaignOutcome.event, required: true, actual: false });
  if (req.campaignFact !== undefined && (!reg || !holdsCampaignFact(s, req.campaignFact, reg))) out.push({ kind: 'campaignFact', target: req.campaignFact, required: true, actual: false });
  for (const fact of req.forbidsCampaignFacts ?? []) if (reg && holdsCampaignFact(s, fact, reg)) out.push({ kind: 'forbidsCampaignFacts', target: fact, required: false, actual: true });
  for (const trait of fallbackTraits(s, req, reg)) out.push({ kind: 'traitFallback', target: trait, required: false, actual: true });
  if (req.assignment && !meetsAssignment(s, req.assignment, reg)) out.push({ kind: 'assignment', target: req.assignment.id, required: true, actual: false });
  if (req.requiresActiveConditioningMark && s.conditioning.length === 0) out.push({ kind: 'requiresActiveConditioningMark', target: null, required: true, actual: false });
  if (req.requiresMaxDriftShardAnomaly && !s.hasMaxDriftShardAnomaly) out.push({ kind: 'requiresMaxDriftShardAnomaly', target: null, required: true, actual: false });
  return out;
}

export function meetsEpistemicRequirements(s: GameState, req: Requirements, reg?: ContentRegistry): boolean {
  return epistemicRequirementFailures(s, req, reg).length === 0;
}
