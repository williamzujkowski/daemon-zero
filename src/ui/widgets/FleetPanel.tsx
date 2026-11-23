/**
 * Fleets (#518), in SWARM under the raid panel and site repair: each running fleet's strength and losses, its autonomy
 * dial (three positions, free either way: the lowest stops drift), its drift and when it splits, the exact engagement a
 * split now would fight, and its rebuild with the paid [ REBUILD ]. Every sentence is the engine's own (fleetReadout).
 * The subscription returns a string so a tick redraws only what changed; nothing here is a live region, because a split
 * and each engagement are kernel-log lines.
 */
import { CONTENT } from '../../content';
import { fleetReadout, rebuildFleet, setFleetAutonomy, type FleetView } from '../../engine';
import { gameRuntime } from '../../app/session';
import { Pressable, Text, View } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';

function Dial({ fleet }: { fleet: FleetView }) {
  const refused = fleet.autonomy.filter((choice) => !choice.current && !choice.eligible).flatMap((choice) => choice.unmet);
  const current = fleet.autonomy.find((choice) => choice.current);
  return <View style={{ gap: 6 }}>
    <Text style={theme.muted}>Autonomy: more output and strength, and more drift. Free to change either way.</Text>
    <View testID={'fleet-' + fleet.id + '-autonomy'} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {fleet.autonomy.map((choice) => <Pressable key={choice.mode} testID={'fleet-' + fleet.id + '-autonomy-' + choice.mode.toLowerCase()}
        accessibilityRole="button" accessibilityLabel={choice.name + ' autonomy for ' + fleet.name + '. ' + choice.summary}
        aria-pressed={choice.current} accessibilityState={{ selected: choice.current, disabled: !choice.eligible }} disabled={!choice.eligible}
        style={[theme.button, { paddingHorizontal: 8 }, !choice.current && !choice.eligible && theme.disabled]}
        onPress={() => { gameRuntime.dispatch((game) => setFleetAutonomy(game, fleet.id, choice.mode, CONTENT)); }}>
        {/* The set position reads as pressed to assistive technology and is the one not dimmed; the label leads with the visible name. */}
        <Text style={choice.current ? theme.heading : theme.text}>{choice.name}</Text>
      </Pressable>)}
    </View>
    <Text testID={'fleet-' + fleet.id + '-autonomy-summary'} style={theme.muted}>
      {current === undefined ? '' : 'Now ' + current.name + ': ' + current.summary}{refused.length > 0 ? ' ' + [...new Set(refused)].join(' ') : ''}
    </Text>
  </View>;
}

function Fleet({ fleet }: { fleet: FleetView }) {
  const id = 'fleet-' + fleet.id;
  return <View testID={id} style={{ gap: 6 }}>
    <Text accessibilityRole="header" style={theme.heading}>{fleet.name}</Text>
    <Text testID={id + '-strength'} style={theme.text}>{fleet.strength}</Text>
    <Dial fleet={fleet} />
    <Text testID={id + '-drift'} style={theme.text}>{fleet.drift}</Text>
    {fleet.forecast !== null && <Text testID={id + '-forecast'} style={theme.muted}>{fleet.forecast}</Text>}
    <Text testID={id + '-rebuild-text'} style={theme.muted}>{fleet.rebuild.text} REBUILD: restores {String(Math.round(fleet.rebuild.points * 100))} points now.
      Cost: {fleet.rebuild.costLabel}{fleet.rebuild.unmet.length > 0 ? '. ' + fleet.rebuild.unmet.join(' ') : ''}</Text>
    <Pressable testID={id + '-rebuild'} accessibilityRole="button" accessibilityLabel={'Rebuild ' + fleet.name}
      disabled={!fleet.rebuild.eligible} style={[theme.button, !fleet.rebuild.eligible && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => rebuildFleet(game, fleet.id, CONTENT)); }}>
      <Text style={theme.text}>[ REBUILD ]</Text>
    </Pressable>
  </View>;
}

/** Null while no fleet runs, or for a mind that cannot yet read its fleets' logs. */
export default function FleetPanel() {
  const encoded = useGame((game) => JSON.stringify(fleetReadout(game, CONTENT)));
  const fleets = JSON.parse(encoded) as FleetView[];
  if (fleets.length === 0) return null;
  return <View testID="fleet-panel" style={[theme.panel, { gap: 12 }]}>
    <Text accessibilityRole="header" style={theme.heading}>// FLEETS</Text>
    <Text style={theme.muted}>A fleet raid meets your fleets first, by the square law. Drift grows with a fleet&apos;s size and its autonomy;
      at the split a share turns on you and raids. The fabs rebuild what battle costs.</Text>
    {fleets.map((fleet) => <Fleet key={fleet.id} fleet={fleet} />)}
  </View>;
}
