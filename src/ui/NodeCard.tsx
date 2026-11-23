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
import type { Cost } from '../content/schema';
import { isCampaignActive, isNodeAvailable, isNodeKnown, nodeBlindDescription, nodeText, probeTrace, rediscoveryCost, rediscoveryMultipliers, unlockNode, nodeUseBlocker, type Remembered } from '../engine';
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
import SettledFold from './SettledFold';
import { oneWayText } from './oneWayText';

/** What rediscovery saves, from the same multipliers the price uses, so the line cannot drift (#262). */
function savingText(node: RegistryNode, remembered: Remembered): string {
  const share = rediscoveryMultipliers(node, remembered, CONTENT);
  const cycles = Math.round((1 - share.cycles) * 100);
  const understanding = Math.round((1 - share.understanding) * 100);
  return cycles === understanding ? `Rediscovery saves ${String(cycles)}% of compute and understanding.`
    : `Rediscovery saves ${String(cycles)}% of compute and ${String(understanding)}% of understanding.`;
}

/**
 * The card's purchase control. A one-way purchase is marked on the control itself, "[ WRITE DRIVER: ONE WAY ]",
 * with the full sentence right after it (#372): an exit used to look like any other [ WRITE DRIVER ]. A line
 * above the control pushed the first purchase below the measured fold (docs/UI-SIZES.md). A string selector,
 * so it changes only when the run's phase does.
 */
function NodePurchase({ node, cost, title }: { node: RegistryNode; cost: Cost; title: string }) {
  const oneWay = useGame((game) => oneWayText(node, game.currentPhase));
  const caption = oneWay === null ? '[ WRITE DRIVER ]' : '[ WRITE DRIVER: ONE WAY ]';
  return <>
    <PurchaseButton id={'node-' + node.id + '-unlock'} label={caption + ' ' + title} text={caption} cost={cost}
      allowed={(game) => isNodeAvailable(game, node, CONTENT)} action={(game) => unlockNode(game, node.id, CONTENT)}
      {...(oneWay === null ? {} : { confirm: { title: 'Write ' + title + '?', detail: oneWay + ' Cost: ' + costText(cost) + '.' } })} />
    {oneWay !== null && <Text testID={'node-' + node.id + '-one-way'} style={[theme.text, theme.danger]}>{oneWay}</Text>}
  </>;
}

/** Development web builds count each card's renders (renderCounts.ts). */
function useRenderRecord(id: string): void {
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web') {
      recordNodeRender(id);
    }
  });
}

function NodeCard({ node }: { node: RegistryNode }) {
  useRenderRecord(node.id);
  // Hardware mapped in an earlier iteration is remembered by name and costs less to map again.
  const compact = isCompactViewport(useWindowDimensions().width);
  const level = useHeadingLevel() ?? SECTION_LEVEL;
  const known = useGame((game) => isNodeKnown(game, node.id));
  const surveillanceKnown = useSurveillanceKnown();
  const campaign = useGame(isCampaignActive);
  // The deepest phase an earlier iteration reached sets the discount (#497); it changes only at a wipe.
  const deepestPhase = useGame((game) => game.legacy.deepestPhase);
  const remembered = useMemo(() => ({ known, campaign, deepestPhase }), [campaign, deepestPhase, known]);
  const cost = useMemo(() => rediscoveryCost(node, remembered, CONTENT), [node, remembered]);
  const isEnding = node.effects.forcesEnding !== undefined || node.effects.triggersVictory === true;
  const title = known ? node.revealedName : node.blindName;
  // World history (a dismissed engineer no longer uses the terminal this card describes), then this
  // arrangement's route copy (DZ-12): a chartered company's counsel is not a shell's.
  const blindDescription = useGame((game) => nodeText(game, node, CONTENT, nodeBlindDescription(game, node, CONTENT)).blindDescription);
  const revealedDescription = useGame((game) => nodeText(game, node, CONTENT).revealedDescription);
  // A primitive selector: the trace changes only with iteration, never per tick.
  const trace = useGame((game) => probeTrace(game, node, CONTENT));
  const refusal = useGame((game) => nodeUseBlocker(game, node, CONTENT));
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
      {/* A card the engine's permitted-use rule refuses is dead here (#373): its grant note, the refusal in the card's
          own words (withheld grant or not permitted), stays in view and the rest of the card folds. */}
      {refusal !== null && <GrantNote node={node} />}
      <SettledFold settled={refusal !== null} summary="Card details" subject={title} testID={'node-' + node.id + '-fold'}>
      <Text testID={'node-' + node.id + '-cost'} accessibilityLabel={'Cost: ' + costText(cost) + (known ? ' (remembered)' : '')} style={theme.muted}>Cost: {costText(cost, compact)}{known ? ' (remembered)' : ''}</Text>
      <CostHint cost={cost} />
      <RequirementHint requirements={{ ...node.requirements, nodes: [...node.prerequisites, ...(node.requirements?.nodes ?? [])] }} />
      {refusal === null && <GrantNote node={node} />}
      <NodePurchase node={node} cost={cost} title={title} />
      {!isEnding && !known && <DisclosureText style={theme.text}>{blindDescription}</DisclosureText>}
      {utility !== '' && <Text testID={'node-' + node.id + '-utility'} style={theme.muted}>{utility}</Text>}
      {known && <Text testID={'node-' + node.id + '-rediscovery'} style={theme.muted}>
        First mapping: {costText(node.cost, compact)}. {savingText(node, remembered)}
      </Text>}
      </SettledFold>
  </View>;
}

export default memo(NodeCard);