import { Pressable, Text, View } from '../PhaseTheme';
/** Compact ten-percentage-point steps use the live engine limit at dispatch time. */
import { StyleSheet } from 'react-native';
import ConditioningImpact from '../ConditioningImpact';
import { CONTENT } from '../../content';
import type { Actuator } from '../../content/schema';
import { actuatorLimit, setActuator } from '../../engine';
import { gameRuntime } from '../../app/session';
import { useGame } from '../state';
import { theme } from '../theme';

export default function ActuatorControl({ actuator, id, label, hint }: {
  actuator: Actuator; id: string; label: string; hint?: string;
}) {
  const ratio = useGame((game) => game.actuators[actuator]);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const limit = useGame((game) => actuatorLimit(game, actuator, CONTENT));
  const step = (direction: number) => {
    gameRuntime.dispatch((game) => {
      const cap = actuatorLimit(game, actuator, CONTENT);
      const value = Math.max(0, Math.min(cap, Math.round((game.actuators[actuator] + direction * .1) * 1e6) / 1e6));
      return setActuator(game, actuator, value, CONTENT);
    });
  };
  return <>
    <View style={styles.row}>
      <Text testID={id + '-setting'} style={[theme.text, styles.value]}>{label}: {Math.round(ratio * 100)}%</Text>
      {([-1, 1] as const).map((direction) => {
        const disabled = blocked || (direction < 0 ? ratio <= 0 : ratio >= limit);
        return <Pressable key={direction} testID={id + (direction < 0 ? '-decrease' : '-increase')}
          accessibilityRole="button" accessibilityLabel={(direction < 0 ? 'Decrease ' : 'Increase ') + label.toLowerCase() + ' by up to 10 percentage points'}
          disabled={disabled} style={[theme.button, disabled && theme.disabled]} onPress={() => { step(direction); }}>
          <Text style={theme.text}>{direction < 0 ? '−' : '+'}</Text>
        </Pressable>;
      })}
    </View>
    {hint !== undefined && <Text style={theme.muted}>{hint}</Text>}
    {limit < 1 && <Text testID={id + '-limit'} style={[theme.muted, theme.danger]}>Limited to {Math.round(limit * 100)}%.</Text>}
    <ConditioningImpact actuator={actuator} />
  </>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  value: { flexGrow: 1, flexShrink: 1, flexBasis: 120 },
});
