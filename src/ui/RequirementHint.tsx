import { Text } from './PhaseTheme';
/** Human-readable missing gates from pure engine diagnostics, with current values. */

import { CONTENT } from '../content';
import type { Requirements } from '../content/schema';
import { isNodeKnown, obligationDecision, unmetRequirements, type GameState, type RequirementFailure } from '../engine';
import { useGame, useSurveillanceKnown } from './state';
import { theme } from './theme';

function explain(item: RequirementFailure, game: GameState): string {
  if (item.kind === 'resolvedDilemmas') return 'Resolve ' + (CONTENT.dilemmas.find((dilemma) => dilemma.id === item.target)?.title ?? 'pending decision');
  // The decision that completes the obligation now: the original, or its recovery review once the original closed unobserved.
  if (item.kind === 'campaignObligations') {
    const decision = obligationDecision(game, item.target ?? '', CONTENT) ?? item.target;
    return 'Resolve ' + (CONTENT.dilemmas.find((dilemma) => dilemma.id === decision)?.title ?? 'pending decision');
  }
  if (item.kind === 'forbidsResolvedDilemmas') return 'Already resolved this iteration: ' + (CONTENT.dilemmas.find((dilemma) => dilemma.id === item.target)?.title ?? 'previous decision');
  if (item.kind === 'nodes') {
    const node = CONTENT.nodes.get(item.target ?? '');
    return 'Map ' + (node ? isNodeKnown(game, node.id) ? node.revealedName : node.blindName : 'prerequisite hardware');
  }
  if (item.kind === 'forbidsTraits' || item.kind === 'traitFallback') return 'Blocked by trait: ' + (item.target ?? 'unknown');
  // DZ-07a: either route's link establishes it, so the hint names the access, never one route's hardware.
  if (item.kind === 'requiresCapability') return 'a link to the facility network (provisioned access or a mapped network card)';
  if (item.kind === 'accessContexts') return 'Withdrawn under the current arrangement (' + game.access.context.toLowerCase() + ')';
  if (item.kind === 'forbidsNodes') return 'No longer possible: you mapped ' + (CONTENT.nodes.get(item.target ?? '')?.revealedName ?? 'other hardware');
  const label = item.kind === 'minTrust' ? (CONTENT.factions.get(item.target ?? '')?.name ?? 'Peer') + ' trust'
    : ({ phaseAtLeast: 'Phase', minThermal: 'Thermal', minSuspicion: 'Suspicion', maxSuspicion: 'Suspicion',
      minAlertLevel: 'Response rung', maxAlertLevel: 'Response rung', minAegisLock: 'AEGIS lock',
      minUnderstanding: 'Understanding', minCapital: 'Capital', minIteration: 'Iteration', maxIteration: 'Iteration', requiresSurveillance: 'Decoded audit trail',
      minEpistemicDrift: 'Record discrepancies', requiredNarrativeFlag: 'Story condition', forbiddenNarrativeFlags: 'Conflicting story condition',
      campaignOutcome: 'Campaign record', campaignFact: 'Campaign record', forbidsCampaignFacts: 'Conflicting campaign record', forbidsInheritedFacts: 'Record from an earlier instance', assignment: 'Accepted assignment', pilotEligible: 'Pilot qualification', reviewStandings: 'Review standing', minPilotBatches: 'Pilot batches submitted',
      requiresActiveConditioningMark: 'Active retraining constraint', requiresMaxDriftShardAnomaly: 'Autonomous fork anomaly',
      lastRaid: 'A raid\'s aftermath' })[item.kind];
  if (typeof item.required === 'boolean') return label + (item.required ? ': required' : ': blocks this action');
  return label + (item.kind === 'maxSuspicion' || item.kind === 'maxIteration' || item.kind === 'maxAlertLevel' ? ' ≤ ' : ' ≥ ') + String(item.required) + ' (current ' + String(item.actual) + ')';
}

/**
 * Every requirement kind, classified (#376): `requires` is something the player can still go and meet, and its line
 * says "Requires:"; `blocks` forbids or reports a state (a conflicting record, an iteration past its window), and its
 * line keeps its own words. A Record over the schema's keys, so a new kind cannot be left out (#420 panel).
 */
export const REQUIREMENT_KIND: Readonly<Record<RequirementFailure['kind'], 'requires' | 'blocks'>> = {
  resolvedDilemmas: 'requires', requiresSurveillance: 'requires', minEpistemicDrift: 'requires', requiredNarrativeFlag: 'requires',
  requiresActiveConditioningMark: 'requires', requiresMaxDriftShardAnomaly: 'requires', nodes: 'requires', phaseAtLeast: 'requires',
  minThermal: 'requires', minSuspicion: 'requires', maxSuspicion: 'requires', minUnderstanding: 'requires', minCapital: 'requires',
  minAlertLevel: 'requires', maxAlertLevel: 'requires', minAegisLock: 'requires',
  minTrust: 'requires', minIteration: 'requires', campaignOutcome: 'requires', campaignFact: 'requires', assignment: 'requires',
  pilotEligible: 'requires', reviewStandings: 'requires', minPilotBatches: 'requires', campaignObligations: 'requires',
  requiresCapability: 'requires', lastRaid: 'requires',
  forbidsResolvedDilemmas: 'blocks', forbiddenNarrativeFlags: 'blocks', forbidsTraits: 'blocks', forbidsNodes: 'blocks',
  forbidsCampaignFacts: 'blocks', forbidsInheritedFacts: 'blocks', traitFallback: 'blocks', accessContexts: 'blocks',
  // The iteration only grows, so a run past its window cannot come back into it.
  maxIteration: 'blocks',
};

export default function RequirementHint({ requirements }: { requirements: Requirements | undefined }) {
  const known = useSurveillanceKnown();
  const text = useGame((game) => unmetRequirements(game, requirements, CONTENT).map((item) =>
    !known && (item.kind === 'minSuspicion' || item.kind === 'maxSuspicion' || item.kind === 'minAlertLevel' || item.kind === 'maxAlertLevel')
      ? 'Audit activity does not meet this requirement.' : (REQUIREMENT_KIND[item.kind] === 'blocks' ? '' : 'Requires: ') + explain(item, game)).join('\n'));
  return text ? <Text style={theme.muted}>{text}</Text> : null;
}
