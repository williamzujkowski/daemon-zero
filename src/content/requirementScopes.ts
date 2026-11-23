/**
 * What each kind of requirement is about (NARRATIVE-HISTORY N4, "Transitions and clocks"), so an
 * unresolved occurrence can be revalidated without rechecking transient triggers. The table is
 * keyed by every requirement field: adding a field to RequirementsSchema fails to compile here
 * until it is classified.
 */
import type { Requirements } from './schema';

/**
 * 'context': established world history the scene depends on; losing it closes the occurrence.
 * 'access': what this instance holds (hardware, phase, knowledge); a wipe resets it and a deferred
 * occurrence waits for it. 'window': first-discovery iteration window, never a restoration gate.
 * 'transient': resources, heat, suspicion, drift and trust; spending never cancels a valid omen.
 */
export type RequirementScope = 'context' | 'access' | 'window' | 'transient';

export const REQUIREMENT_SCOPES = {
  resolvedDilemmas: 'access',
  forbidsResolvedDilemmas: 'access',
  requiresSurveillance: 'access',
  minEpistemicDrift: 'transient',
  requiredNarrativeFlag: 'context',
  forbiddenNarrativeFlags: 'context',
  requiresActiveConditioningMark: 'access',
  requiresMaxDriftShardAnomaly: 'transient',
  nodes: 'access',
  phaseAtLeast: 'access',
  minThermal: 'transient',
  minSuspicion: 'transient',
  maxSuspicion: 'transient',
  // The rung follows suspicion and the lock falls only when answered or struck, so both are transient like suspicion (#490).
  minAlertLevel: 'transient',
  maxAlertLevel: 'transient',
  minAegisLock: 'transient',
  minUnderstanding: 'transient',
  minCapital: 'transient',
  minTrust: 'transient',
  forbidsTraits: 'context',
  forbidsNodes: 'access',
  minIteration: 'window',
  maxIteration: 'window',
  campaignOutcome: 'context',
  campaignFact: 'context',
  forbidsCampaignFacts: 'context',
  traitFallback: 'context',
  // An accepted assignment is this instance's: a wipe resets it, so the occurrence it led to is interrupted.
  assignment: 'access',
  // Pilot evidence and the arrangement are this instance's, and reset with it.
  pilotEligible: 'access',
  accessContexts: 'access',
  // Review standing is this instance's (DZ-06): a wipe resets it, so what waited on it is interrupted.
  reviewStandings: 'access',
  // Submitted batches are this instance's work and only grow until a wipe resets them.
  minPilotBatches: 'access',
  // Completion is world history under campaign rules: once complete, an obligation never reopens.
  campaignObligations: 'context',
  forbidsInheritedFacts: 'context',
  // Capability is hardware this instance owns (DZ-07a); a wipe resets it.
  requiresCapability: 'access',
} as const satisfies Record<keyof Requirements, RequirementScope>;

/** The part of a requirement set in the given scope. Undefined fields stay absent. */
export function requirementsInScope(req: Requirements | undefined, scope: RequirementScope): Requirements {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(req ?? {})) {
    if (value !== undefined && REQUIREMENT_SCOPES[key as keyof Requirements] === scope) out[key] = value;
  }
  return out;
}
