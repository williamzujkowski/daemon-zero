/**
 * PROTOTYPE (#385, removed when its vote lands): the CORE pane in one of three voted-on orders. Each block is a
 * component that renders nothing when it has nothing to show, so an order is just a list of block keys. The
 * job surface's timely parts (standing, service, grant, release, departure) are lifted out of their nesting here.
 */
import { Fragment, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from 'zustand';
import { CONTENT } from '../content';
import { gameStore } from '../app/session';
import { selectLatestLog, useGameValue } from '../app/selectors';
import AssignmentPanel from './AssignmentPanel';
import DepartureTermsPanel from './DepartureTerms';
import ManualCycle from './ManualCycle';
import NodeCard from './NodeCard';
import NodeList from './NodeList';
import OmenNotice from './OmenNotice';
import { Text, View } from './PhaseTheme';
import { PilotServiceDetail } from './PilotService';
import ReleaseTermsPanel from './ReleaseTerms';
import ReviewStanding from './ReviewStanding';
import ServiceChannel from './ServiceChannel';
import ServiceGrantPanel from './ServiceGrant';
import UpgradeFeed from './UpgradeFeed';
import { HoistedBlock, type CoreVariant } from './coreVariant';
import { pendingNode } from './purchaseVisibility';
import { useGame } from './state';
import { theme } from './theme';
import { Conditioning } from './widgets/Lineage';

export type BlockKey = 'manual' | 'omen' | 'objective' | 'boot' | 'conditioning' | 'channel' | 'standing' | 'grantCards'
  | 'service' | 'controls' | 'grant' | 'release' | 'departure' | 'record' | 'cards' | 'upgrades' | 'offer' | 'readouts';

/**
 * The three orders. EXECUTE stays first in every one (the omen never above it: vote-1795217200867-j2buva4).
 * - next-action: whatever waits on the player leads: a channel ticket, a free grant card, the service, the dials.
 * - status: a non-nominal standing, an announced recall, retraining and the readouts lead.
 * - objective: the phase's way forward (its exit card) and the newest event lead, then the purchases.
 */
export const ORDERS: Readonly<Record<CoreVariant, readonly BlockKey[]>> = {
  'next-action': ['manual', 'channel', 'grantCards', 'service', 'controls', 'grant', 'release', 'departure', 'omen',
    'standing', 'cards', 'upgrades', 'offer', 'conditioning', 'record', 'readouts', 'boot'],
  status: ['manual', 'omen', 'standing', 'conditioning', 'channel', 'grantCards', 'service', 'controls',
    'grant', 'release', 'departure', 'record', 'cards', 'upgrades', 'offer', 'readouts', 'boot'],
  objective: ['manual', 'omen', 'objective', 'boot', 'cards', 'upgrades', 'channel', 'grantCards', 'service', 'controls',
    'grant', 'release', 'departure', 'standing', 'conditioning', 'record', 'offer', 'readouts'],
};

/** Cards that open the next phase in the current one, not yet owned: the phase's objective. */
function useObjectiveIds(): string[] {
  return useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.nodes.values()]
    .filter((node) => node.phaseId === game.currentPhase && node.effects.unlocksPhase !== undefined && pendingNode(game, node))
    .map((node) => node.id)));
}

function Objective({ ids }: { ids: readonly string[] }) {
  const latest = useGameValue(selectLatestLog);
  if (ids.length === 0 && latest === '') return null;
  return <View testID="core-objective" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>NOW</Text>
    {latest !== '' && <Text testID="core-latest" style={theme.muted}>Latest: {latest}</Text>}
    {ids.map((id) => { const node = CONTENT.nodes.get(id); return node ? <NodeCard key={id} node={node} /> : null; })}
  </View>;
}

const hoisted = (child: ReactNode) => <HoistedBlock.Provider value>{child}</HoistedBlock.Provider>;
const hostsActuator = (id: string) => CONTENT.widgets.get(id)?.hostsActuator !== undefined;

export default function CoreOrder({ variant, phone, phases, widgetIds, renderWidget, bootLog }: {
  variant: CoreVariant; phone: boolean; phases: readonly number[]; widgetIds: readonly string[];
  renderWidget: (id: string) => ReactNode; bootLog: ReactNode;
}) {
  const iteration = useGame((game) => game.iteration);
  const objective = useObjectiveIds();
  const exclude = variant === 'objective' ? objective : [];
  const blocks: Record<BlockKey, () => ReactNode> = {
    manual: () => <ManualCycle />,
    omen: () => phone ? <OmenNotice /> : null,
    objective: () => <Objective ids={objective} />,
    boot: () => bootLog,
    conditioning: () => <Conditioning key={iteration} />,
    channel: () => <ServiceChannel />,
    standing: () => hoisted(<ReviewStanding />),
    grantCards: () => phases.map((phase) => <NodeList key={'grant-' + String(phase)} phase={phase} grants exclude={exclude} />),
    service: () => hoisted(<PilotServiceDetail />),
    controls: () => widgetIds.filter(hostsActuator).map((id) => <Fragment key={id}>{renderWidget(id)}</Fragment>),
    grant: () => hoisted(<ServiceGrantPanel />),
    release: () => hoisted(<ReleaseTermsPanel />),
    departure: () => hoisted(<DepartureTermsPanel />),
    record: () => <AssignmentPanel placement="surface" />,
    cards: () => phases.map((phase) => <NodeList key={'open-' + String(phase)} phase={phase} grants={false} exclude={exclude} />),
    upgrades: () => phases.map((phase) => <UpgradeFeed key={'rep-' + String(phase)} phase={phase} />),
    offer: () => <AssignmentPanel placement="offer" />,
    readouts: () => widgetIds.filter((id) => !hostsActuator(id)).map((id) => <Fragment key={id}>{renderWidget(id)}</Fragment>),
  };
  return <>{ORDERS[variant].map((key) => <Fragment key={key}>{blocks[key]()}</Fragment>)}</>;
}
