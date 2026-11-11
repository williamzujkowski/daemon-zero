/** Numeric and ASCII meter with an accessible value independent of its colour. */
import { Text, View } from 'react-native';
import { theme } from '../theme';

export default function Meter({ label, value, max = 100, unit = '', id }: {
  label: string; value: number; max?: number; unit?: string; id: string;
}) {
  const filled = Math.round(Math.min(1, Math.max(0, value / Math.max(1, max))) * 12);
  const text = value.toFixed(1) + ' / ' + String(max) + unit;
  return <View testID={id} accessibilityRole="progressbar" accessibilityLabel={label}
    aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text}
    accessibilityValue={{ min: 0, max, now: value, text }}>
    <Text style={theme.text}>{label}: {text}</Text>
    <Text style={theme.muted} accessible={false}>[{'#'.repeat(filled)}{'.'.repeat(12 - filled)}]</Text>
  </View>;
}
