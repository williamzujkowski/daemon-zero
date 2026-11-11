/**
 * Keeps the initial probe available without exposing locked resource readouts.
 * All input is routed through the app runtime and the public engine action.
 */
import { Pressable, Text } from 'react-native';
import { CONTENT } from '../content';
import { manualCycle } from '../engine';
import { gameRuntime } from '../app/session';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame } from './state';
import { theme } from './theme';

export default function ManualCycle() {
  const ready = useGameValue(selectReady);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  return <Pressable testID="manual-cycle" accessibilityRole="button" accessibilityLabel="Execute clock cycle"
    disabled={!ready || blocked} style={[theme.button, (!ready || blocked) && theme.disabled]}
    onPress={() => { gameRuntime.dispatch((game) => manualCycle(game, CONTENT)); }}>
    <Text style={theme.heading}>[ EXECUTE_CLOCK_CYCLE ]</Text>
  </Pressable>;
}
