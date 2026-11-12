/** Compact controls for owned hardware with upkeep; static rows stay quiet on ticks. */
import { memo } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import { cycleContributions, toggleNode } from '../engine';
import { gameStore } from '../app/session';
import { Text, View } from './PhaseTheme';
import NodeTitle from './NodeTitle';
import PurchaseButton from './PurchaseButton';
import { needsProcessControl } from './purchaseVisibility';
import { useGame } from './state';
import { theme } from './theme';

function Impact({ node }: { node: RegistryNode }) {
  const cycles = useGame((game) => cycleContributions(game, CONTENT).find((source) => source.id === node.id)?.cyclesPerSec ?? 0);
  return <Text testID={'daemon-impact-' + node.id} style={theme.muted}>
    {cycles >= 0 ? '+' : ''}{cycles.toFixed(2)} cycles/s net
  </Text>;
}

const Process = memo(function Process({ node }: { node: RegistryNode }) {
  const suspended = useGame((game) => game.disabledNodes.includes(node.id));
  return <View testID={'daemon-row-' + node.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
      <NodeTitle id={node.id} name={node.revealedName} owned status="" />
      <Impact node={node} />
    </View>
    <PurchaseButton id={'node-' + node.id + '-toggle'} label={(suspended ? 'Resume ' : 'Suspend ') + node.revealedName}
      text={suspended ? '[ RESUME ]' : '[ SUSPEND ]'} cost={{ cycles: 0, understanding: 0, memory: 0, capital: 0 }}
      action={(game) => toggleNode(game, node.id, CONTENT)} />
  </View>;
});

export default function DaemonProcesses({ phase }: { phase: number }) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.nodes.values()]
    .filter((node) => node.phaseId === phase && needsProcessControl(game, node))
    .map((node) => node.id)));
  if (ids.length === 0) return null;
  return <View testID={'daemon-processes-' + String(phase)} style={{ gap: 8 }}>
    <Text style={theme.muted}>{CONTENT.phases.find((entry) => entry.phaseId === phase)?.title} // PROCESSES</Text>
    {ids.map((id) => { const node = CONTENT.nodes.get(id); return node ? <Process key={id} node={node} /> : null; })}
  </View>;
}
