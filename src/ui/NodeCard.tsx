/**
 * A node card rerenders only for ownership or suspension changes.
 * Purchase eligibility is isolated in a leaf; instrumentation records commits.
 */
import { memo, useEffect, useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import { isNodeAvailable, isNodeKnown, rediscoveryCost, toggleNode, unlockNode } from '../engine';
import PurchaseButton from './PurchaseButton';
import { costText, deltaText } from './format';
import { useGame } from './state';
import { theme } from './theme';
import RequirementHint from './RequirementHint';
import { recordNodeRender } from '../app/renderCounts';
import CostHint from './CostHint';

function NodeCard({ node }: { node: RegistryNode }) {
  const owned = useGame((game) => game.unlockedNodes.includes(node.id));
  const suspended = useGame((game) => game.disabledNodes.includes(node.id));
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web') {
      recordNodeRender(node.id);
    }
  });
  // Hardware mapped in an earlier iteration is remembered by name and costs less to map again.
  const known = useGame((game) => isNodeKnown(game, node.id));
  const cost = useMemo(() => rediscoveryCost(node, known, CONTENT), [known, node]);
  const revealed = owned || known;
  const title = revealed ? node.revealedName : node.blindName;
  return <View testID={'node-' + node.id} style={theme.panel}>
    <Text style={theme.heading}>{owned ? suspended ? '[SUSPENDED] ' : '[ONLINE] ' : known ? '[REMEMBERED] ' : '[UNMAPPED] '}{title}</Text>
    <Text style={theme.text}>{revealed ? node.revealedDescription : node.blindDescription}</Text>
    {owned ? <>
      <Text style={theme.muted}>{deltaText(node.tickDelta) || 'No continuous output'}</Text>
      {node.actuatorBinding !== undefined && <Text style={theme.muted}>Output scales with actuator setting.</Text>}
      <PurchaseButton id={'node-' + node.id + '-toggle'} label={(suspended ? 'Resume ' : 'Suspend ') + title}
        cost={{ cycles: 0, understanding: 0, memory: 0, capital: 0 }}
        action={(game) => toggleNode(game, node.id, CONTENT)} />
    </> : <>
      <Text testID={'node-' + node.id + '-cost'} style={theme.muted}>Cost: {costText(cost)}{known ? ' (remembered)' : ''}</Text>
      <CostHint cost={cost} />
      <RequirementHint requirements={{ ...node.requirements, nodes: [...node.prerequisites, ...(node.requirements?.nodes ?? [])] }} />
      <PurchaseButton id={'node-' + node.id + '-unlock'} label={'[ WRITE DRIVER ] ' + title} cost={cost}
        allowed={(game) => isNodeAvailable(game, node)} action={(game) => unlockNode(game, node.id, CONTENT)} />
    </>}
  </View>;
}

export default memo(NodeCard);
