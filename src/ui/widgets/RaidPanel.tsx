/**
 * The raid under way (#517), in SWARM beside the hostile card, because raids share the hostile slot: what is coming,
 * its stage, the matchup, the exact forecast while what the player holds does not change, attribution, the battle log
 * and the aftermath. Battles fight themselves, so a rival's only way out is free and needs no control: going dark before
 * the battle. A drift deviant (#518) is the player's own fleet, which going dark does not lose: its way out before the
 * battle is the paid [ RECLAIM ]. Every line is the engine's own view. Nothing here is a live region: the arrival and each
 * round are kernel-log lines and the workspace notice, so a raid never speaks on every tick.
 */
import { CONTENT } from '../../content';
import { gameRuntime } from '../../app/session';
import { raidView, reclaimDeviant, type RaidView } from '../../engine';
import CardDetails from '../CardDetails';
import { Pressable, Text, View } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';

function Lines({ id, title, lines }: { id: string; title: string; lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return <View testID={id} style={{ gap: 4 }}>
    <Text accessibilityRole="header" style={theme.heading}>{title}</Text>
    {lines.map((line) => <Text key={line} style={theme.muted}>{line}</Text>)}
  </View>;
}

function Reclaim({ reclaim }: { reclaim: NonNullable<RaidView['reclaim']> }) {
  return <View style={{ gap: 4 }}>
    <Text testID="raid-reclaim-text" style={theme.muted}>{reclaim.text} Cost: {reclaim.costLabel}{reclaim.unmet.length > 0 ? '. ' + reclaim.unmet.join(' ') : ''}</Text>
    <Pressable testID="raid-reclaim" accessibilityRole="button" accessibilityLabel="Reclaim the deviant force" disabled={!reclaim.eligible}
      style={[theme.button, !reclaim.eligible && theme.disabled]} onPress={() => { gameRuntime.dispatch((game) => reclaimDeviant(game, CONTENT)); }}>
      <Text style={theme.text}>[ RECLAIM ]</Text>
    </Pressable>
  </View>;
}

export default function RaidPanel() {
  const encoded = useGame((game) => JSON.stringify(raidView(game, CONTENT)));
  const view = JSON.parse(encoded) as RaidView | null;
  if (!view) return null;
  return <View testID="raid-panel" style={[theme.panel, { gap: 10 }]}>
    <CardDetails id={'raid-' + view.id} title={'// RAID: ' + view.name} description={view.description} />
    <Text testID="raid-attacker" style={theme.muted}>A {view.domain.toLowerCase()} raid by {view.attacker}: {view.vector.toLowerCase()}.</Text>
    <Text testID="raid-stage" style={theme.text}>{view.stageText}</Text>
    <Text testID="raid-matchup" style={theme.muted}>{view.matchup}</Text>
    {view.goDark !== null && <Text testID="raid-go-dark" style={theme.muted}>{view.goDark}</Text>}
    {view.reclaim !== null && <Reclaim reclaim={view.reclaim} />}
    <Text testID="raid-attribution" style={theme.muted}>{view.attribution}</Text>
    <Lines id="raid-forecast" title="Forecast" lines={view.forecast} />
    <Lines id="raid-log" title="Battle log" lines={view.log} />
    {view.aftermath !== null && <Text testID="raid-aftermath" style={theme.text}>{view.aftermath}</Text>}
  </View>;
}

/** The same raid in the Other Minds console and the world view: what it is and where it stands, read-only, pointing to SWARM. */
export function RaidStatus() {
  const line = useGame((game) => {
    const view = raidView(game, CONTENT);
    return view ? `RAID // ${view.name} on ${view.target.toLowerCase()}. ${view.stageText} Follow it in SWARM.` : '';
  });
  if (line === '') return null;
  return <Text testID="raid-status" style={theme.text}>{line}</Text>;
}
