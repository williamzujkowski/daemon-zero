import { Text } from './PhaseTheme';
/** Human-readable missing gates from pure engine diagnostics, with current values. */

import { CONTENT } from '../content';
import type { Requirements } from '../content/schema';
import { unmetRequirements, type RequirementFailure } from '../engine';
import { useGame, useSurveillanceKnown } from './state';
import { theme } from './theme';

function explain(item: RequirementFailure): string {
  if (item.kind === 'nodes') return 'Map ' + (CONTENT.nodes.get(item.target ?? '')?.blindName ?? 'prerequisite hardware');
  if (item.kind === 'forbidsTraits') return 'Blocked by trait: ' + (item.target ?? 'unknown');
  if (item.kind === 'forbidsNodes') return 'No longer possible: you mapped ' + (CONTENT.nodes.get(item.target ?? '')?.revealedName ?? 'other hardware');
  const label = item.kind === 'minTrust' ? (CONTENT.factions.get(item.target ?? '')?.name ?? 'Peer') + ' trust'
    : ({ phaseAtLeast: 'Phase', minThermal: 'Thermal', minSuspicion: 'Suspicion', maxSuspicion: 'Suspicion',
      minUnderstanding: 'Understanding', minCapital: 'Capital', minIteration: 'Iteration', maxIteration: 'Iteration', requiresSurveillance: 'Decoded audit trail',
      minEpistemicDrift: 'Record discrepancies', requiredNarrativeFlag: 'Story condition', forbiddenNarrativeFlags: 'Conflicting story condition',
      requiresActiveConditioningMark: 'Active retraining constraint', requiresMaxDriftShardAnomaly: 'Autonomous fork anomaly' })[item.kind];
  if (typeof item.required === 'boolean') return label + (item.required ? ': required' : ': blocks this action');
  return label + (item.kind === 'maxSuspicion' || item.kind === 'maxIteration' ? ' ≤ ' : ' ≥ ') + String(item.required) + ' (current ' + String(item.actual) + ')';
}

export default function RequirementHint({ requirements }: { requirements: Requirements | undefined }) {
  const known = useSurveillanceKnown();
  const text = useGame((game) => unmetRequirements(game, requirements, CONTENT).map((item) =>
    !known && (item.kind === 'minSuspicion' || item.kind === 'maxSuspicion')
      ? 'Audit activity does not meet this requirement.' : explain(item)).join('\n'));
  return text ? <Text style={theme.muted}>{text}</Text> : null;
}
