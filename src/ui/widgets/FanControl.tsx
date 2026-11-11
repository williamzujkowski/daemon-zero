/** Five engine actuator settings, with numeric and selected-state feedback. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../../content';
import { setActuator } from '../../engine';
import { gameRuntime } from '../../app/session';
import { useGame } from '../state';
import { palette, theme } from '../theme';

export default function FanControl() {
  const ratio = useGame((game) => game.actuators.fanSpeedRatio);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  return <>
    <Text testID="fan-setting" style={theme.text}>Fan output: {Math.round(ratio * 100)}%</Text>
    <View style={styles.steps}>{[0, 0.25, 0.5, 0.75, 1].map((value) => <Pressable key={value}
      testID={'fan-' + String(value * 100)} accessibilityRole="button" accessibilityLabel={'Set fan to ' + String(value * 100) + ' percent'}
      accessibilityState={{ selected: value === ratio }} aria-pressed={value === ratio} disabled={blocked}
      onPress={() => { gameRuntime.dispatch((game) => setActuator(game, 'fanSpeedRatio', value, CONTENT)); }}
      style={[theme.button, styles.step, value === ratio && styles.active, blocked && theme.disabled]}>
      <Text style={theme.text}>{value * 100}%</Text>
    </Pressable>)}</View>
  </>;
}
const styles = StyleSheet.create({
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { paddingHorizontal: 8 },
  active: { backgroundColor: palette.raised, borderWidth: 2 },
});
