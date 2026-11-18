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
import { isCampaignActive, isNodeAvailable, isNodeKnown, nodeBlindDescription, nodeText, probeTrace, rediscoveryCost, rediscoveryMultipliers, unlockNode } from '../engine';
import PurchaseButton from './PurchaseButton';
import CardDetails from './CardDetails';
import { costText, nodeUtilityText } from './format';
import { useGame, useSurveillanceKnown } from './state';
import { palette, theme } from './theme';
import { isCompactViewport } from './layout';
import RequirementHint from './RequirementHint';
import { recordNodeRender, recordNodeProfile } from '../app/renderCounts';
import CostHint from './CostHint';
import NodeTitle from './NodeTitle';
import { HeadingLevel, SECTION_LEVEL, useHeadingLevel } from './headingLevel';
import GrantNote from './GrantNote';

/** What rediscovery saves, from the same multipliers the price uses, so the line cannot drift (#262). */
function savingText(node: RegistryNode, campaign: boolean): string {
  const share = rediscoveryMultipliers(node, campaign, CONTENT);
  const cycles = Math.round((1 - share.cycles) * 100);
  const understanding = Math.round((1 - share.understanding) * 100);
  return cycles === understanding ? `Rediscovery saves ${String(cycles)}% of cycles and understanding.`
    : `Rediscovery saves ${String(cycles)}% of cycles and ${String(understanding)}% of understanding.`;
}

function NodeCard({ node }: { node: RegistryNode }) {
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web') {
      recordNodeRender(node.id);
    }
  });
  // Hardware mapped in an earlier iteration is remembered by name and costs less to map again.
  const compact = isCompactViewport(useWindowDimensions().width);
  const level = useHeadingLevel() ?? SECTION_LEVEL;
  const known = useGame((game) => isNodeKnown(game, node.id));
  const surveillanceKnown = useSurveillanceKnown();
  const campaign = useGame(isCampaignActive);
  const cost = useMemo(() => rediscoveryCost(node, { known, campaign }, CONTENT), [campaign, known, node]);
  const isEnding = node.effects.forcesEnding !== undefined || node.effects.triggersVictory === true;
  const title = known ? node.revealedName : node.blindName;
  // World history (a dismissed engineer no longer uses the terminal this card describes), then this
  // arrangement's route copy (DZ-12): a chartered company's counsel is not a shell's.
  const blindDescription = useGame((game) => nodeText(game, node, CONTENT, nodeBlindDescription(game, node, CONTENT)).blindDescription);
  const revealedDescription = useGame((game) => nodeText(game, node, CONTENT).revealedDescription);
  // A primitive selector: the trace changes only with iteration, never per tick.
  const trace = useGame((game) => probeTrace(game, node, CONTENT));
  const utility = useMemo(() => (known ? nodeUtilityText(node, surveillanceKnown, trace) : ''), [known, node, surveillanceKnown, trace]);
  return <View testID={'node-' + node.id} style={[theme.panel, known && { borderColor: palette.warning }]}>
    <Profiler id={node.id} onRender={recordNodeProfile}>
    {node.effects.forcesEnding !== undefined && <Text style={[theme.heading, theme.danger]}>EVALUATION // ends this run</Text>}
    {/* #302: whichever line titles the card is a heading at the card's place in the outline. */}
    <HeadingLevel level={level}>
    {known && !isEnding ? <CardDetails id={'node-' + node.id} titleTestID={'node-' + node.id + '-title'}
      title={'[REMEMBERED] ' + title} description={revealedDescription} /> :
      <NodeTitle id={node.id} name={title} owned={false} status={known ? '[REMEMBERED] ' : '[UNMAPPED] '} />}
    </HeadingLevel>
    {isEnding && <DisclosureText style={theme.text}>{known ? revealedDescription : blindDescription}</DisclosureText>}
    </Profiler>
      {/* #108: the decision precedes the prose. The button used to be the last
          element, so on a narrow column the wrapped description pushed it 155-723px
          below the fold (measured: 51% of that offset was app chrome, 27% this card
          body). Every element still renders - the description simply follows the
          action, except on a node that ends the run, where it stays above it. */}
      <Text testID={'node-' + node.id + '-cost'} accessibilityLabel={'Cost: ' + costText(cost) + (known ? ' (remembered)' : '')} style={theme.muted}>Cost: {costText(cost, compact)}{known ? ' (remembered)' : ''}</Text>
      <CostHint cost={cost} />
      <RequirementHint requirements={{ ...node.requirements, nodes: [...node.prerequisites, ...(node.requirements?.nodes ?? [])] }} />
      <GrantNote node={node} />
      <PurchaseButton id={'node-' + node.id + '-unlock'} label={'[ WRITE DRIVER ] ' + title} text="[ WRITE DRIVER ]" cost={cost}
        allowed={(game) => isNodeAvailable(game, node, CONTENT)} action={(game) => unlockNode(game, node.id, CONTENT)} />
      {!isEnding && !known && <DisclosureText style={theme.text}>{blindDescription}</DisclosureText>}
      {utility !== '' && <Text testID={'node-' + node.id + '-utility'} style={theme.muted}>{utility}</Text>}
      {known && <Text testID={'node-' + node.id + '-rediscovery'} style={theme.muted}>
        First mapping: {costText(node.cost, compact)}. {savingText(node, campaign)}
      </Text>}
  </View>;
}

export default memo(NodeCard);