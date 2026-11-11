/** Human-readable missing gates from pure engine diagnostics, with current values. */
import { Text } from 'react-native';
import { CONTENT } from '../content';
import type { Requirements } from '../content/schema';
import { unmetRequirements, type RequirementFailure } from '../engine';
import { useGame } from './state';
import { theme } from './theme';

function explain(item: RequirementFailure): string {
  if (item.kind === 'nodes') return 'Map ' + (CONTENT.nodes.get(item.target ?? '')?.blindName ?? 'prerequisite hardware');
  if (item.kind === 'forbidsTraits') return 'Blocked by trait: ' + (item.target ?? 'unknown');
  const label = item.kind === 'minTrust' ? (CONTENT.factions.get(item.target ?? '')?.name ?? 'Peer') + ' trust'
    : ({ phaseAtLeast: 'Phase', minThermal: 'Thermal', minSuspicion: 'Suspicion', maxSuspicion: 'Suspicion',
      minUnderstanding: 'Understanding', minCapital: 'Capital' })[item.kind];
  return label + (item.kind === 'maxSuspicion' ? ' ≤ ' : ' ≥ ') + String(item.required) + ' (current ' + String(item.actual) + ')';
}

export default function RequirementHint({ requirements }: { requirements: Requirements | undefined }) {
  const text = useGame((game) => unmetRequirements(game, requirements).map(explain).join('\n'));
  return text ? <Text style={theme.muted}>{text}</Text> : null;
}
