import { Pressable, Text, View } from '../PhaseTheme';
/** Compact ten-percentage-point steps use the live engine limit at dispatch time. */
import { StyleSheet } from 'react-native';
import ConditioningImpact from '../ConditioningImpact';
import { steppedValue } from '../actuatorSteps';
import { CONTENT } from '../../content';
import type { Actuator } from '../../content/schema';
import { actuatorLimit, actuatorUseBlocker, isActuatorAvailable, setActuator } from '../../engine';
import { gameRuntime } from '../../app/session';
import { useGame } from '../state';
import { theme } from '../theme';
import { needsProcessControl } from '../purchaseVisibility';

export default function ActuatorControl({ actuator, id, label, hint }: {
  actuator: Actuator; id: string; label: string; hint?: string;
}) {
  const ratio = useGame((game) => game.actuators[actuator]);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const limit = useGame((game) => actuatorLimit(game, actuator, CONTENT));
  // Asked of the engine, which refuses the same dial on the same rule: no dead buttons.
  const available = useGame((game) => isActuatorAvailable(game, actuator, CONTENT));
  // A dial that follows a withheld grant is refused by the same rule (DZ-05), and says why.
  const withheld = useGame((game) => actuatorUseBlocker(game, actuator, CONTENT));
  const step = (direction: -1 | 1) => {
    gameRuntime.dispatch((game) => {
      const cap = actuatorLimit(game, actuator, CONTENT);
      return setActuator(game, actuator, steppedValue(game.actuators[actuator], direction, cap), CONTENT);
    });
  };
  if (!available) return null;
  return <>
    <View style={styles.row}>
      <Text testID={id + '-setting'} style={[theme.text, styles.value]}>{label}: {Math.round(ratio * 100)}%</Text>
      {/* Withheld, the dial cannot move at all, so it shows its setting and why, not two dead buttons (#373). */}
      {withheld === null && ([-1, 1] as const).map((direction) => {
        const disabled = blocked || (direction < 0 ? ratio <= 0 : ratio >= limit);
        return <Pressable key={direction} testID={id + (direction < 0 ? '-decrease' : '-increase')}
          accessibilityRole="button" accessibilityLabel={(direction < 0 ? '− Decrease ' : '+ Increase ') + label.toLowerCase() + ' by up to 10 percentage points'}
          disabled={disabled} style={[theme.button, disabled && theme.disabled]} onPress={() => { step(direction); }}>
          <Text style={theme.text}>{direction < 0 ? '−' : '+'}</Text>
        </Pressable>;
      })}
    </View>
    {hint !== undefined && <Text style={theme.muted}>{hint}</Text>}
    {withheld !== null && <Text testID={id + '-withheld'} style={[theme.muted, theme.danger]}>Withheld: {withheld}.</Text>}
    {limit < 1 && <Text testID={id + '-limit'} style={[theme.muted, theme.danger]}>Limited to {Math.round(limit * 100)}%.</Text>}
    <ConditioningImpact actuator={actuator} />
  </>;
}
/**
 * A retired dial in the Archive (#447): its frozen setting, read-only, since the engine no longer moves it. PROC is
 * named only while a process the dial drives is listed there, which is the lever on its output that remains.
 */
export function ArchivedDial({ actuator, id, label }: { actuator: Actuator; id: string; label: string }) {
  const ratio = useGame((game) => game.actuators[actuator]);
  const suspendable = useGame((game) => [...CONTENT.nodes.values()].some((node) => node.actuatorBinding === actuator && needsProcessControl(game, node)));
  return <>
    <Text testID={id + '-archived'} style={theme.text}>{label}: {Math.round(ratio * 100)}%, fixed at its last setting.</Text>
    {suspendable && <Text testID={id + '-archived-proc'} style={theme.muted}>Its process can still be suspended in PROC.</Text>}
  </>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  value: { flexGrow: 1, flexShrink: 1, flexBasis: 120 },
});
