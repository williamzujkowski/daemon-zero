import { Text, View } from '../PhaseTheme';
import DisclosureText from '../DisclosureText';
/** Registry phase/group metadata builds one network tree without duplicate cards. */

import { CONTENT } from '../../content';
import { cycleContributions } from '../../engine';
import ActionsPanel from '../ActionsPanel';
import NodeList from '../NodeList';
import DaemonProcesses from '../DaemonProcesses';
import { hasPhasePurchases, needsProcessControl } from '../purchaseVisibility';
import Repeatables from '../Repeatables';
import { useGame } from '../state';
import { theme } from '../theme';

function NetworkPhase({ phase, title }: { phase: number; title: string }) {
  const pending = useGame((game) => hasPhasePurchases(game, phase, 'TREE'));
  const processes = useGame((game) => [...CONTENT.nodes.values()].some((node) =>
    node.phaseId === phase && node.uiGroup === 'TREE' && needsProcessControl(game, node)));
  if (!pending && !processes) return null;
  return <View style={{ gap: 14 }}>
    {pending && <>
      <Text testID={'purchase-phase-' + String(phase)} style={theme.heading}>{title}</Text>
      <NodeList phase={phase} group="TREE" />
      <Repeatables phase={phase} />
    </>}
    <DaemonProcesses phase={phase} group="TREE" />
  </View>;
}

export function NetworkTree() {
  const current = useGame((game) => game.currentPhase);
  return <View style={{ gap: 14 }}>{CONTENT.phases.filter((phase) => phase.uiSlot === 'NETWORK' && phase.phaseId <= current)
    .sort((left, right) => right.phaseId - left.phaseId).map((phase) =>
      <NetworkPhase key={phase.phaseId} phase={phase.phaseId} title={phase.title} />)}</View>;
}

export function NetworkActions() {
  const groups = [...new Set([...CONTENT.actions.values()]
    .filter((action) => !CONTENT.factions.has(action.group) && action.group !== 'CORP').map((action) => action.group))];
  return <View style={{ gap: 14 }}>{groups.map((group) => <View key={group} style={{ gap: 10 }}>
    <Text style={theme.heading}>{group}</Text><ActionsPanel group={group} />
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
