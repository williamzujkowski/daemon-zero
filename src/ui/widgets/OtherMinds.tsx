import { Text, View } from '../PhaseTheme';
import DisclosureText from '../DisclosureText';
import CardDetails from '../CardDetails';
/** Faction identity, actions and offers are all indexed by registry metadata. */

import { CONTENT } from '../../content';
import type { Faction } from '../../content/schema';
import { isPeerLost, worldViewOpen } from '../../engine';
import ActionsPanel from '../ActionsPanel';
import NodeList from '../NodeList';
import { useGame } from '../state';
import { theme } from '../theme';
import AegisStatus from './AegisStatus';
import Meter from './Meter';
import WorldView from './WorldView';
import { HostileStatus } from './HostileEncounter';

function FactionPanel({ faction }: { faction: Faction }) {
  const trust = useGame((game) => game.trust[faction.id] ?? faction.initialTrust);
  const phase = useGame((game) => game.currentPhase);
  const lost = useGame((game) => isPeerLost(game, faction.id, CONTENT));
  const permanentTradeRule = [...CONTENT.actions.values()].some((action) => action.group === faction.id &&
    ((action.requirements.forbidsTraits?.length ?? 0) > 0 || action.requirements.traitFallback !== undefined));
  return <View testID={'faction-' + faction.id} style={theme.panel}>
    {permanentTradeRule ? <>
      <Text accessibilityRole="header" style={theme.heading}>{faction.name}</Text>
      <DisclosureText style={theme.text}>{faction.description}</DisclosureText>
    </> : <CardDetails id={'faction-' + faction.id} title={faction.name} description={faction.description} />}
    <Text style={theme.muted}>Disposition: {faction.disposition.replaceAll('_', ' ')}</Text>
    {lost && faction.lost ? <Text testID={'faction-' + faction.id + '-lost'} style={theme.muted}>{faction.lost.status}</Text>
      : <Meter id={'trust-' + faction.id} label={faction.name + ' trust'} value={trust} />}
    <ActionsPanel group={faction.id} />
    {CONTENT.phases.filter((entry) => entry.phaseId <= phase).map((entry) =>
      <NodeList key={entry.phaseId} phase={entry.phaseId} group={faction.id} showLocked />)}
  </View>;
}

/**
 * Before its disclosure phase the console is AEGIS and the faction panels. From then on it is the world view (#463),
 * which keeps the same faction panels, once, under Other minds: no parallel faction display.
 */
export default function OtherMinds() {
  const world = useGame((game) => worldViewOpen(game, CONTENT));
  const factions = [...CONTENT.factions.values()].map((faction) => <FactionPanel key={faction.id} faction={faction} />);
  if (world) return <WorldView factions={factions} />;
  return <View style={{ gap: 16 }}>
    <AegisStatus />
    <HostileStatus />
    {factions}
  </View>;
}
