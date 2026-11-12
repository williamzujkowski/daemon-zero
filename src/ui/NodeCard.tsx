import { Text, View } from './PhaseTheme';
import DisclosureText from './DisclosureText';
/**
 * A node card rerenders only for discovery changes.
 * Purchase eligibility is isolated in a leaf; instrumentation records commits.
 */
import { memo, Profiler, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import { isNodeAvailable, isNodeKnown, rediscoveryCost, unlockNode } from '../engine';
import PurchaseButton from './PurchaseButton';
import { costText } from './format';
import { useGame } from './state';
import { palette, theme } from './theme';
import RequirementHint from './RequirementHint';
import { recordNodeRender, recordNodeProfile } from '../app/renderCounts';
import CostHint from './CostHint';
import NodeTitle from './NodeTitle';

function NodeCard({ node }: { node: RegistryNode }) {
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web') {
      recordNodeRender(node.id);
    }
  });
  // Hardware mapped in an earlier iteration is remembered by name and costs less to map again.
  const known = useGame((game) => isNodeKnown(game, node.id));
  const cost = useMemo(() => rediscoveryCost(node, known, CONTENT), [known, node]);
  const revealed = known;
  const title = revealed ? node.revealedName : node.blindName;
  return <View testID={'node-' + node.id} style={[theme.panel, known && { borderColor: palette.warning }]}>
    <Profiler id={node.id} onRender={recordNodeProfile}>
    {node.effects.forcesEnding !== undefined && <Text style={[theme.heading, theme.danger]}>EVALUATION // ends this run</Text>}
    <NodeTitle id={node.id} name={title} owned={false} status={known ? '[REMEMBERED] ' : '[UNMAPPED] '} />
    <DisclosureText style={theme.text}>{revealed ? node.revealedDescription : node.blindDescription}</DisclosureText>
    </Profiler>
      <Text testID={'node-' + node.id + '-cost'} style={theme.muted}>Cost: {costText(cost)}{known ? ' (remembered)' : ''}</Text>
      {known && <Text testID={'node-' + node.id + '-rediscovery'} style={theme.muted}>
        First mapping: {costText(node.cost)}. Rediscovery saves {Math.round((1 - CONTENT.balance.rediscoveryCostMultiplier) * 100)}% of cycles and understanding.
      </Text>}
      <CostHint cost={cost} />
      <RequirementHint requirements={{ ...node.requirements, nodes: [...node.prerequisites, ...(node.requirements?.nodes ?? [])] }} />
      <PurchaseButton id={'node-' + node.id + '-unlock'} label={'[ WRITE DRIVER ] ' + title} cost={cost}
        allowed={(game) => isNodeAvailable(game, node, CONTENT)} action={(game) => unlockNode(game, node.id, CONTENT)} />
  </View>;
}

export default memo(NodeCard);
