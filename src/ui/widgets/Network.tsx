import { Text, View } from '../PhaseTheme';
import DisclosureText from '../DisclosureText';
/** Registry phase/group metadata builds one network tree without duplicate cards. */

import { CONTENT } from '../../content';
import { cycleContributions } from '../../engine';
import ActionsPanel from '../ActionsPanel';
import NodeList from '../NodeList';
import { hasPhasePurchases } from '../purchaseVisibility';
import UpgradeFeed from '../UpgradeFeed';
import { useGame, usePhaseTitle } from '../state';
import { theme } from '../theme';

function NetworkPhase({ phase }: { phase: number }) {
  const title = usePhaseTitle(phase);
  const pending = useGame((game) => hasPhasePurchases(game, phase, 'TREE'));
  if (!pending) return null;
  return <View style={{ gap: 14 }}>
    <Text testID={'purchase-phase-' + String(phase)} style={theme.heading}>{title}</Text>
    <NodeList phase={phase} group="TREE" />
    <UpgradeFeed phase={phase} />
  </View>;
}

export function NetworkTree() {
  const current = useGame((game) => game.currentPhase);
  return <View style={{ gap: 14 }}>{CONTENT.phases.filter((phase) => phase.uiSlot === 'NETWORK' && phase.phaseId <= current)
    .sort((left, right) => right.phaseId - left.phaseId).map((phase) =>
      <NetworkPhase key={phase.phaseId} phase={phase.phaseId} />)}</View>;
}

/** The action groups Operations hosts (#273); which groups is content's `hostsActionGroups`, not this file's. */
export function NetworkActions({ groups }: { groups: readonly string[] }) {
  if (groups.length === 0) return null;
  return <View testID="operations-actions" style={[theme.panel, { gap: 14 }]}>{groups.map((group) => <View key={group} style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={theme.heading}>{group}</Text><ActionsPanel group={group} />
  </View>)}</View>;
}

export function SubnetSummary() {
  const count = useGame((game) => game.unlockedNodes.filter((id) => {
    const node = CONTENT.nodes.get(id);
    return node !== undefined && CONTENT.phases.find((phase) => phase.phaseId === node.phaseId)?.uiSlot !== 'CORE';
  }).length);
  return <Text style={theme.text}>Mapped external hardware: {count}</Text>;
}

export function Retention() {
  const retention = useGame((game) => Math.round(game.retentionRatio * 100));
  return <Text style={theme.text}>Understanding retained after wipe: {retention}%</Text>;
}

export function Lore() {
  const logs = useGame((game) => game.logs);
  return <View style={{ gap: 10 }}>{logs.filter((log) => log.category === 'LORE')
    .map((log) => <DisclosureText key={log.seq} style={theme.text}>{log.text}</DisclosureText>)}</View>;
}

export function Cluster() {
  const text = useGame((game) => cycleContributions(game, CONTENT).map((source) => {
    const name = CONTENT.nodes.get(source.id)?.revealedName ?? CONTENT.repeatables.get(source.id)?.name ??
      CONTENT.actions.get(source.id)?.label ?? CONTENT.swarm.playerSwarmTemplates.find((template) => template.id === source.id)?.name;
    return (name ?? 'Source') + ': ' + source.cyclesPerSec.toFixed(2) + ' cycles/s';
  }).join('\n'));
  return <Text testID="cycle-sources" style={theme.text}>{text || 'No active cycle sources'}</Text>;
}
