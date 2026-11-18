/** Compact controls for owned hardware with upkeep; static rows stay quiet on ticks. */
import { memo } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import { cycleContributions, nodeUseBlocker, toggleNode } from '../engine';
import { gameStore } from '../app/session';
import { Text, View } from './PhaseTheme';
import NodeTitle from './NodeTitle';
import GrantNote from './GrantNote';
import PurchaseButton from './PurchaseButton';
import { needsProcessControl } from './purchaseVisibility';
import { useGame, usePhaseTitle } from './state';
import { theme } from './theme';

function Impact({ node }: { node: RegistryNode }) {
  // A loan adds no cycles of the player's own, so its row says what it is instead (story 12); any
  // row the permitted-use rule refuses also says why (story 15).
  return <>{node.grant === undefined && <CycleImpact node={node} />}<GrantNote node={node} /></>;
}

function CycleImpact({ node }: { node: RegistryNode }) {
  const cycles = useGame((game) => cycleContributions(game, CONTENT).find((source) => source.id === node.id)?.cyclesPerSec ?? 0);
  const held = node.cost.memory;
  // Memory is what the player is hunting when they open this panel: a process that holds
  // 4096 MB has to say so next to the control that takes it back (maintainer playtest note).
  return <Text testID={'daemon-impact-' + node.id} style={theme.muted}>
    {cycles >= 0 ? '+' : ''}{cycles.toFixed(2)} cycles/s net{held > 0 ? ' · ' + String(held) + ' MB held' : ''}
  </Text>;
}

const Process = memo(function Process({ node }: { node: RegistryNode }) {
  const suspended = useGame((game) => game.disabledNodes.includes(node.id));
  return <View testID={'daemon-row-' + node.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
      <NodeTitle id={node.id} name={node.revealedName} owned status="" />
      <Impact node={node} />
    </View>
    {/* Hardware is a physical card: it cannot be suspended, so it is not offered, and the
        row says why rather than hiding a control the player is looking for (nexus vote
        software-types-only-free-their-memory). */}
    {node.suspendable
      ? <PurchaseButton id={'node-' + node.id + '-toggle'} label={(suspended ? 'Resume ' : 'Suspend ') + node.revealedName
          + (suspended ? '' : ' and free ' + String(node.cost.memory) + ' MB')}
        text={suspended ? '[ RESUME ]' : '[ SUSPEND ]'} cost={{ cycles: 0, understanding: 0, memory: 0, capital: 0 }}
        allowed={(game) => !game.disabledNodes.includes(node.id) || nodeUseBlocker(game, node, CONTENT) === null}
        action={(game) => toggleNode(game, node.id, CONTENT)} />
      : <Text testID={'daemon-hardware-' + node.id} style={theme.muted}>[ HARDWARE ] cannot be suspended</Text>}
  </View>;
});

export default function DaemonProcesses({ phase }: { phase: number }) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.nodes.values()]
    .filter((node) => node.phaseId === phase && needsProcessControl(game, node))
    .map((node) => node.id)));
  const title = usePhaseTitle(phase);
  if (ids.length === 0) return null;
  return <View testID={'daemon-processes-' + String(phase)} style={{ gap: 8 }}>
    <Text style={theme.muted}>{title} // PROCESSES</Text>
    {ids.map((id) => { const node = CONTENT.nodes.get(id); return node ? <Process key={id} node={node} /> : null; })}
  </View>;
}
