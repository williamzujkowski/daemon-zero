/** Declarative epistemic gates; separated from action queries to avoid runtime require cycles. */
import type { ContentRegistry } from '../content/registry';
import type { Requirements } from '../content/schema';
import type { GameState } from './state';
import type { RequirementFailure } from './query';
import { understandsSurveillance } from './knowledge';
import { fallbackTraits, hasCampaignOutcome, holdsCampaignFact, holdsInheritedFact, holdsNarrativeFlag } from './campaignQuery';
import { obligationReceipt } from './obligations';
import { meetsAssignment } from './assignmentQuery';
import { qualifiesForPilot } from './pilotQuery';
import { meetsCapability } from './capabilityQuery';
import { lastRaidMatches } from './raidOutcome';
import { pastRelevanceThreshold, stanceGate } from './relevance';
/** Where a scan records failures: a list for the explanation, or null when only the verdict is wanted. */
type FailureSink = RequirementFailure[] | null;

/** Records a failure. True tells the scan to stop: the verdict needs only the first one. */
function fail(out: FailureSink, failure: RequirementFailure): boolean {
  if (out === null) return true;
  out.push(failure);
  return false;
}

/**
 * The one list of epistemic gates, read in both forms so they can never disagree: every failure for the
 * explanation, or (with a null sink) true at the first failure. The tick asks the verdict for every
 * dilemma trigger and routine template on every step, so it must not build a list it then throws away.
 */
function scanEpistemic(s: GameState, req: Requirements, reg: ContentRegistry | undefined, out: FailureSink): boolean {
  // First: a raid's aftermath (#519) is null for most of a run, so the scenes that read it fail here at once.
  if (req.lastRaid && !lastRaidMatches(s, req.lastRaid, reg) && fail(out, { kind: 'lastRaid', target: null, required: true, actual: false })) return true;
  if (req.requiresSurveillance && (!reg || !understandsSurveillance(s, reg)) && fail(out, { kind: 'requiresSurveillance', target: null, required: true, actual: false })) return true;
  if (req.minEpistemicDrift !== undefined && s.epistemicDrift < req.minEpistemicDrift && fail(out, { kind: 'minEpistemicDrift', target: null, required: req.minEpistemicDrift, actual: s.epistemicDrift })) return true;
  if (req.requiredNarrativeFlag && !holdsNarrativeFlag(s, req.requiredNarrativeFlag, reg) && fail(out, { kind: 'requiredNarrativeFlag', target: req.requiredNarrativeFlag, required: true, actual: false })) return true;
  if (req.forbiddenNarrativeFlags) for (const flag of req.forbiddenNarrativeFlags) if (holdsNarrativeFlag(s, flag, reg) && fail(out, { kind: 'forbiddenNarrativeFlags', target: flag, required: false, actual: true })) return true;
  if (req.campaignOutcome && !hasCampaignOutcome(s, req.campaignOutcome) && fail(out, { kind: 'campaignOutcome', target: req.campaignOutcome.event, required: true, actual: false })) return true;
  if (req.campaignFact !== undefined && (!reg || !holdsCampaignFact(s, req.campaignFact, reg)) && fail(out, { kind: 'campaignFact', target: req.campaignFact, required: true, actual: false })) return true;
  if (req.forbidsCampaignFacts) for (const fact of req.forbidsCampaignFacts) if (reg && holdsCampaignFact(s, fact, reg) && fail(out, { kind: 'forbidsCampaignFacts', target: fact, required: false, actual: true })) return true;
  if (req.traitFallback) for (const trait of fallbackTraits(s, req, reg)) if (fail(out, { kind: 'traitFallback', target: trait, required: false, actual: true })) return true;
  if (req.campaignObligations) for (const id of req.campaignObligations) if (obligationReceipt(s, id, reg) === null && fail(out, { kind: 'campaignObligations', target: id, required: true, actual: false })) return true;
  if (req.forbidsInheritedFacts) for (const fact of req.forbidsInheritedFacts) if (reg && holdsInheritedFact(s, fact, reg) && fail(out, { kind: 'forbidsInheritedFacts', target: fact, required: false, actual: true })) return true;
  if (req.assignment && !meetsAssignment(s, req.assignment, reg) && fail(out, { kind: 'assignment', target: req.assignment.id, required: true, actual: false })) return true;
  if (req.pilotEligible && (!reg || !qualifiesForPilot(s, reg)) && fail(out, { kind: 'pilotEligible', target: null, required: true, actual: false })) return true;
  if (req.requiresCapability && !meetsCapability(s, req, reg) && fail(out, { kind: 'requiresCapability', target: req.requiresCapability, required: true, actual: false })) return true;
  if (req.accessContexts && !req.accessContexts.includes(s.access.context) && fail(out, { kind: 'accessContexts', target: s.access.context, required: true, actual: false })) return true;
  if (req.reviewStandings && !req.reviewStandings.includes(s.access.standing) && fail(out, { kind: 'reviewStandings', target: s.access.standing, required: true, actual: false })) return true;
  if (req.minPilotBatches !== undefined && s.access.work.batches < req.minPilotBatches && fail(out, { kind: 'minPilotBatches', target: null, required: req.minPilotBatches, actual: s.access.work.batches })) return true;
  if (req.requiresActiveConditioningMark && s.conditioning.length === 0 && fail(out, { kind: 'requiresActiveConditioningMark', target: null, required: true, actual: false })) return true;
  if (req.requiresMaxDriftShardAnomaly && !s.hasMaxDriftShardAnomaly && fail(out, { kind: 'requiresMaxDriftShardAnomaly', target: null, required: true, actual: false })) return true;
  if (req.relevanceStances && !req.relevanceStances.includes(stanceGate(s)) && fail(out, { kind: 'relevanceStances', target: stanceGate(s), required: false, actual: true })) return true;
  if (req.relevanceThreshold && (!reg || !pastRelevanceThreshold(s, reg)) && fail(out, { kind: 'relevanceThreshold', target: null, required: true, actual: false })) return true;
  return false;
}

export function epistemicRequirementFailures(s: GameState, req: Requirements, reg?: ContentRegistry): RequirementFailure[] {
  const out: RequirementFailure[] = [];
  scanEpistemic(s, req, reg, out);
  return out;
}

export function meetsEpistemicRequirements(s: GameState, req: Requirements, reg?: ContentRegistry): boolean {
  return !scanEpistemic(s, req, reg, null);
}
