import { Text, View } from '../PhaseTheme';
import DisclosureText from '../DisclosureText';
/** Registry phase/group metadata builds one network tree without duplicate cards. */

import { CONTENT } from '../../content';
import { cycleContributions, understandingShare, type GameState } from '../../engine';
import { sharePercent } from '../carryText';
import ActionsPanel from '../ActionsPanel';
import NodeList from '../NodeList';
import { phaseHasLevers } from '../purchaseVisibility';
import UpgradeFeed from '../UpgradeFeed';
import { useGame, usePhaseTitle } from '../state';
import { theme } from '../theme';
import { quantityReadout } from '../../engine';

function NetworkPhase({ phase }: { phase: number }) {
  const title = usePhaseTitle(phase);
  // Also while the phase holds a level to release (#488 pass 5): a bought-out, capped phase keeps its release rows.
  const shown = useGame((game) => phaseHasLevers(game, phase, { group: 'TREE', kind: 'UPGRADE' }));
  if (!shown) return null;
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

/** What a forced wipe keeps now: hardware's floor or running escrow (#498), the share previewWipe uses. */
export function Retention() {
  const retention = useGame((game) => sharePercent(understandingShare(game, CONTENT, 'SUSPICION')));
  return <Text style={theme.text}>Understanding a forced wipe keeps: {retention}</Text>;
}

export function Lore() {
  const logs = useGame((game) => game.logs);
  return <View style={{ gap: 10 }}>{logs.filter((log) => log.category === 'LORE')
    .map((log) => <DisclosureText key={log.seq} style={theme.text}>{log.text}</DisclosureText>)}</View>;
}

/**
 * One line per compute source, its rate in FLOP/s in the shared number scheme ("520 TFLOP/s", #406). A source that
 * availability or network coupling discounts (#484) says what arrives of its raw rate, and a first line totals both.
 */
export function clusterText(game: GameState): string {
  const sources = cycleContributions(game, CONTENT);
  const lines = sources.map((source) => {
    const name = CONTENT.nodes.get(source.id)?.revealedName ?? CONTENT.repeatables.get(source.id)?.name ??
      CONTENT.actions.get(source.id)?.label ?? CONTENT.swarm.playerSwarmTemplates.find((template) => template.id === source.id)?.name;
    const raw = source.rawCyclesPerSec > source.cyclesPerSec ? ' of ' + quantityReadout('computeRate', source.rawCyclesPerSec) + ' raw' : '';
    // Granted output is marked (DZ-10.2); owned output reads as it always did.
    return (name ?? 'Source') + ': ' + quantityReadout('computeRate', source.cyclesPerSec) + raw + (source.basis === 'GRANTED' ? ' (granted)' : '');
  });
  const effective = sources.reduce((sum, source) => sum + Math.max(0, source.cyclesPerSec), 0);
  const raw = sources.reduce((sum, source) => sum + Math.max(0, source.rawCyclesPerSec), 0);
  const total = raw > effective ? [`Effective ${quantityReadout('computeRate', effective)} of ${quantityReadout('computeRate', raw)} raw`] : [];
  return [...total, ...lines].join('\n');
}

export function Cluster() {
  const text = useGame(clusterText);
  return <Text testID="cycle-sources" style={theme.text}>{text || 'No active compute sources'}</Text>;
}
