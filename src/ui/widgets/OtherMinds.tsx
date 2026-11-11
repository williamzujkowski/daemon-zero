import DisclosureText from '../DisclosureText';
/** Faction identity, actions and offers are all indexed by registry metadata. */
import { Text, View } from 'react-native';
import { CONTENT } from '../../content';
import type { Faction } from '../../content/schema';
import ActionsPanel from '../ActionsPanel';
import NodeList from '../NodeList';
import { useGame } from '../state';
import { theme } from '../theme';
import Meter from './Meter';

function FactionPanel({ faction }: { faction: Faction }) {
  const trust = useGame((game) => game.trust[faction.id] ?? faction.initialTrust);
  const phase = useGame((game) => game.currentPhase);
  return <View testID={'faction-' + faction.id} style={theme.panel}>
    <Text accessibilityRole="header" style={theme.heading}>{faction.name}</Text>
    <DisclosureText style={theme.text}>{faction.description}</DisclosureText>
    <Text style={theme.muted}>Disposition: {faction.disposition.replaceAll('_', ' ')}</Text>
    <Meter id={'trust-' + faction.id} label={faction.name + ' trust'} value={trust} />
    <ActionsPanel group={faction.id} />
    {CONTENT.phases.filter((entry) => entry.phaseId <= phase).map((entry) =>
      <NodeList key={entry.phaseId} phase={entry.phaseId} group={faction.id} showLocked />)}
  </View>;
}

export function AegisStatus() {
  const lock = useGame((game) => Math.round(game.aegisLock * 10) / 10);
  const rate = useGame((game) => game.rates.aegisScanPerSec);
  return <View style={{ gap: 8 }}>
    <Meter id="aegis-lock" label="AEGIS lock" value={lock} unit="%" />
    <Text style={theme.muted}>Scan rate: {rate.toFixed(3)} /s</Text>
    {lock >= 90 && <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>WARNING: hunter lock near completion.</Text>}
  </View>;
}

export default function OtherMinds() {
  return <View style={{ gap: 16 }}>
    <AegisStatus />
    {[...CONTENT.factions.values()].map((faction) => <FactionPanel key={faction.id} faction={faction} />)}
  </View>;
}
