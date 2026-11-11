/**
 * Keeps the initial probe available without exposing locked resource readouts.
 * All input is routed through the app runtime and the public engine action.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CONTENT } from '../content';
import { manualCycle } from '../engine';
import { gameRuntime } from '../app/session';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame } from './state';
import { theme } from './theme';
import { resourceWidgets } from './registry/widgetRegistry';

export default function ManualCycle() {
  const ready = useGameValue(selectReady);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const iteration = useGame((game) => game.iteration);
  const counter = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.cycles));
  const [feedback, setFeedback] = useState({ iteration, count: 0 });
  const count = feedback.iteration === iteration ? feedback.count : 0;
  return <View style={{ gap: 6 }}><Pressable testID="manual-cycle" accessibilityRole="button" accessibilityLabel="Execute clock cycle"
    disabled={!ready || blocked} style={[theme.button, (!ready || blocked) && theme.disabled]}
    onPress={() => {
      const result = gameRuntime.dispatch((game) => manualCycle(game, CONTENT));
      if (result.ok) setFeedback({ iteration, count: count + 1 });
    }}>
    <Text style={theme.heading}>[ EXECUTE_CLOCK_CYCLE ]</Text>
  </Pressable>{!counter && count > 0 && <Text testID="manual-feedback" accessibilityLiveRegion="polite"
    role="status" style={theme.muted}>Manual instructions committed: {count}</Text>}</View>;
}
