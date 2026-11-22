/**
 * The CORE pane's order (#385, status-first: vote-1795245515054-vgmv0a9; history readouts after the purchases:
 * vote-1795246136374-t01m4ug). What can be non-nominal leads: the omen, the review standing and the recall, retraining.
 * Then what waits on the player, then the purchases, then history. Each block renders nothing when it has nothing to
 * show, so the order is just a list of block keys.
 */
import { Fragment, type ReactNode } from 'react';
import { CONTENT } from '../content';
import { retiredWidgets } from '../engine';
import { manualCycleWidget } from './registry/widgetRegistry';
import AssignmentPanel from './AssignmentPanel';
import DepartureTermsPanel from './DepartureTerms';
import ManualCycle from './ManualCycle';
import NodeList from './NodeList';
import OmenNotice from './OmenNotice';
import { PilotServiceDetail } from './PilotService';
import ReleaseTermsPanel from './ReleaseTerms';
import ReviewStanding from './ReviewStanding';
import ServiceChannel from './ServiceChannel';
import ServiceGrantPanel from './ServiceGrant';
import UpgradeFeed from './UpgradeFeed';
import { jobSurfaceGates } from './jobSurfaceGates';
import { useGame } from './state';
import { Conditioning } from './widgets/Lineage';

export type CoreBlock = 'manual' | 'boot' | 'omen' | 'standing' | 'conditioning' | 'channel' | 'grantCards' | 'service'
  | 'routeControls' | 'grant' | 'release' | 'departure' | 'record' | 'cards' | 'upgrades' | 'offer' | 'widgets';

/**
 * EXECUTE first, and the omen never above it (vote-1795217200867-j2buva4). The boot log renders only in the opening,
 * under the control, as UI-SPEC's opening describes. The route's own dials sit with its work. Every other CORE widget
 * (the history readouts and the standing dials) keeps its place after the purchases: ahead of them, the run table
 * scrolled the skim control out of view on the phone (#385) and the skim dial pushed the first phase 1 purchase below
 * the small-phone fold (docs/UI-SIZES.md).
 */
export const CORE_ORDER: readonly CoreBlock[] = ['manual', 'boot', 'omen', 'standing', 'conditioning', 'channel', 'grantCards',
  'service', 'routeControls', 'grant', 'release', 'departure', 'record', 'cards', 'upgrades', 'offer', 'widgets'];

/** A route control: a widget hosting an actuator that a grant card unlocks (the pilot's loaned allocation), from content. */
const ROUTE_CONTROLS: ReadonlySet<string> = new Set([...CONTENT.nodes.values()].flatMap((node) =>
  node.grant !== undefined && node.unlocksUiComponent !== null && CONTENT.widgets.get(node.unlocksUiComponent)?.hostsActuator !== undefined
    ? [node.unlocksUiComponent] : []));

export default function CorePane({ phone, phases, widgetIds, renderWidget, bootLog }: {
  phone: boolean; phases: readonly number[]; widgetIds: readonly string[];
  renderWidget: (id: string) => ReactNode; bootLog: ReactNode;
}) {
  const iteration = useGame((game) => game.iteration);
  // Each lifted job-surface block shows only where it showed nested in the job record (#408 panel).
  const standing = useGame((game) => jobSurfaceGates(game).standing);
  const service = useGame((game) => jobSurfaceGates(game).service);
  const terms = useGame((game) => jobSurfaceGates(game).terms);
  // EXECUTE was demoted once automation dwarfed it, and retires to the Archive at the scale content names (#447).
  const cycleRetired = useGame((game) => retiredWidgets(game, CONTENT).includes(manualCycleWidget));
  const widgets = (route: boolean) => widgetIds.filter((id) => ROUTE_CONTROLS.has(id) === route)
    .map((id) => <Fragment key={id}>{renderWidget(id)}</Fragment>);
  const blocks: Record<CoreBlock, () => ReactNode> = {
    manual: () => cycleRetired ? null : <ManualCycle />,
    boot: () => bootLog,
    // On the phone, below the primary action; column tiers keep it in the fixed chrome (vote-1795219347137-c21nx42).
    omen: () => phone ? <OmenNotice /> : null,
    standing: () => standing ? <ReviewStanding /> : null,
    conditioning: () => <Conditioning key={iteration} />,
    channel: () => <ServiceChannel />,
    grantCards: () => phases.map((phase) => <NodeList key={'grant-' + String(phase)} phase={phase} grants />),
    service: () => service ? <PilotServiceDetail /> : null,
    routeControls: () => widgets(true),
    grant: () => service ? <ServiceGrantPanel /> : null,
    release: () => terms ? <ReleaseTermsPanel /> : null,
    departure: () => terms ? <DepartureTermsPanel /> : null,
    record: () => <AssignmentPanel placement="surface" />,
    cards: () => phases.map((phase) => <NodeList key={'open-' + String(phase)} phase={phase} grants={false} />),
    upgrades: () => phases.map((phase) => <UpgradeFeed key={'rep-' + String(phase)} phase={phase} />),
    offer: () => <AssignmentPanel placement="offer" />,
    widgets: () => widgets(false),
  };
  return <>{CORE_ORDER.map((key) => <Fragment key={key}>{blocks[key]()}</Fragment>)}</>;
}
