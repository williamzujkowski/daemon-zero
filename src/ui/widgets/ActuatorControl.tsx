/** Five-step engine actuator setting, with numeric and selected-state feedback. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../../content';
import type { Actuator } from '../../content/schema';
import { setActuator } from '../../engine';
import { gameRuntime } from '../../app/session';
import { useGame } from '../state';
import { palette, theme } from '../theme';

export default function ActuatorControl({ actuator, id, label, hint }: {
  actuator: Actuator; id: string; label: string; hint?: string;
}) {
  const ratio = useGame((game) => game.actuators[actuator]);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  return <>
    <Text testID={id + '-setting'} style={theme.text}>{label}: {Math.round(ratio * 100)}%</Text>
    {hint !== undefined && <Text style={theme.muted}>{hint}</Text>}
    <View style={styles.steps}>{[0, 0.25, 0.5, 0.75, 1].map((value) => <Pressable key={value}
      testID={id + '-' + String(value * 100)} accessibilityRole="button"
      accessibilityLabel={'Set ' + label.toLowerCase() + ' to ' + String(value * 100) + ' percent'}
      accessibilityState={{ selected: value === ratio }} aria-pressed={value === ratio} disabled={blocked}
      onPress={() => { gameRuntime.dispatch((game) => setActuator(game, actuator, value, CONTENT)); }}
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
