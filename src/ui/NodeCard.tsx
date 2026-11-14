import { Text, View } from './PhaseTheme';
import DisclosureText from './DisclosureText';
/**
 * A node card rerenders only for discovery changes.
 * Purchase eligibility is isolated in a leaf; instrumentation records commits.
 */
import { memo, Profiler, useEffect, useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { CONTENT } from '../content';
import type { RegistryNode } from '../content/registry';
import { isNodeAvailable, isNodeKnown, probeTrace, rediscoveryCost, unlockNode } from '../engine';
import PurchaseButton from './PurchaseButton';
import CardDetails from './CardDetails';
import { costText, nodeUtilityText } from './format';
import { useGame, useSurveillanceKnown } from './state';
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
  const compact = useWindowDimensions().width < 900;
  const known = useGame((game) => isNodeKnown(game, node.id));
  const surveillanceKnown = useSurveillanceKnown();
  const cost = useMemo(() => rediscoveryCost(node, known, CONTENT), [known, node]);
  const isEnding = node.effects.forcesEnding !== undefined || node.effects.triggersVictory === true;
  const title = known ? node.revealedName : node.blindName;
  // A primitive selector: the trace changes only with iteration, never per tick.
  const trace = useGame((game) => probeTrace(game, node, CONTENT));
  const utility = useMemo(() => (known ? nodeUtilityText(node, surveillanceKnown, trace) : ''), [known, node, surveillanceKnown, trace]);
  return <View testID={'node-' + node.id} style={[theme.panel, known && { borderColor: palette.warning }]}>
    <Profiler id={node.id} onRender={recordNodeProfile}>
    {node.effects.forcesEnding !== undefined && <Text style={[theme.heading, theme.danger]}>EVALUATION // ends this run</Text>}
    {known && !isEnding ? <CardDetails id={'node-' + node.id} titleTestID={'node-' + node.id + '-title'}
      title={'[REMEMBERED] ' + title} description={node.revealedDescription} /> : <>
      <NodeTitle id={node.id} name={title} owned={false} status={known ? '[REMEMBERED] ' : '[UNMAPPED] '} />
      <DisclosureText style={theme.text}>{known ? node.revealedDescription : node.blindDescription}</DisclosureText>
    </>}
    {utility !== '' && <Text testID={'node-' + node.id + '-utility'} style={theme.muted}>{utility}</Text>}
    </Profiler>
      <Text testID={'node-' + node.id + '-cost'} accessibilityLabel={'Cost: ' + costText(cost) + (known ? ' (remembered)' : '')} style={theme.muted}>Cost: {costText(cost, compact)}{known ? ' (remembered)' : ''}</Text>
      {known && <Text testID={'node-' + node.id + '-rediscovery'} style={theme.muted}>
        First mapping: {costText(node.cost, compact)}. Rediscovery saves {Math.round((1 - CONTENT.balance.rediscoveryCostMultiplier) * 100)}% of cycles and understanding.
      </Text>}
      <CostHint cost={cost} />
      <RequirementHint requirements={{ ...node.requirements, nodes: [...node.prerequisites, ...(node.requirements?.nodes ?? [])] }} />
      <PurchaseButton id={'node-' + node.id + '-unlock'} label={'[ WRITE DRIVER ] ' + title} text="[ WRITE DRIVER ]" cost={cost}
        allowed={(game) => isNodeAvailable(game, node, CONTENT)} action={(game) => unlockNode(game, node.id, CONTENT)} />
  </View>;
}

export default memo(NodeCard);
