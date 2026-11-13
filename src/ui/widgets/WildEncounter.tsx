/** A pending signal is a choice between an immediate burst and reserved host memory. */
import { CONTENT } from '../../content';
import { resolveWildEncounter, wildEncounterView } from '../../engine';
import { gameRuntime } from '../../app/session';
import { Text, View, Pressable } from '../PhaseTheme';
import Effects from '../Effects';
import CardDetails from '../CardDetails';
import { useGame } from '../state';
import { theme } from '../theme';
export default function WildEncounter() {
  const encoded = useGame((game) => JSON.stringify(wildEncounterView(game, CONTENT)));
  const view = JSON.parse(encoded) as ReturnType<typeof wildEncounterView>;
  if (!view) return null;
  return <View testID="wild-encounter" style={[theme.panel, { gap: 10 }]}>
    <CardDetails id={'wild-' + view.id} title={'// WILD_SIGNAL: ' + view.title}
      description={view.signature + '\n' + view.description} />
    <Text testID="wild-origin" style={theme.muted}>{view.origin}</Text>
    <Text style={theme.heading}>CONSUME // immediate burst</Text><Effects effects={view.consume} />
    <Text style={theme.muted}>{view.unmet.join('\n')}</Text>
    <Pressable testID="wild-consume" accessibilityRole="button" accessibilityLabel={'Consume ' + view.title}
      disabled={!view.consumeEligible} style={[theme.button, !view.consumeEligible && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => resolveWildEncounter(game, 'CONSUME', CONTENT)); }}><Text style={theme.text}>[ CONSUME ]</Text></Pressable>
    <Text style={theme.heading}>HARNESS // {view.harnessCostLabel}</Text>
    <Text testID="wild-output" style={theme.text}>{view.harnessOutput}</Text>
    <Text style={theme.muted}>{view.harnessUnmet.join('\n')}</Text>
    <Pressable testID="wild-harness" accessibilityRole="button" accessibilityLabel={'Harness ' + view.title}
      disabled={!view.harnessEligible} style={[theme.button, !view.harnessEligible && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => resolveWildEncounter(game, 'HARNESS', CONTENT)); }}><Text style={theme.text}>[ HARNESS ]</Text></Pressable>
  </View>;
}
