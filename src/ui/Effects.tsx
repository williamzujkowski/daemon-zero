import { Text, View } from './PhaseTheme';
/** Consequence badges use signed numbers and explicit labels as well as colour. */

import type { EffectPayload } from '../content/schema';
import { CONTENT } from '../content';
import { useSurveillanceKnown } from './state';
import { palette, theme } from './theme';

export default function Effects({ effects }: { effects: EffectPayload }) {
  const known = useSurveillanceKnown();
  const rows: [string, number, boolean][] = [
    ['cycles', effects.cyclesDelta, true], ['understanding', effects.understandingDelta, true],
    ['capital', effects.capitalDelta, true], ['thermal °C', effects.thermalDelta, false],
    ['suspicion', effects.suspicionDelta, false], ['AEGIS lock', effects.aegisLockDelta, false],
    ['memory capacity MB', effects.memoryCapIncrease, true],
    ['epistemic drift', effects.epistemicDriftDelta ?? 0, false],
    ...Object.entries(effects.trustDelta).map(([id, value]): [string, number, boolean] =>
      [(CONTENT.factions.get(id)?.name ?? 'Peer') + ' trust', value, true]),
  ];
  return <View>{rows.filter(([, value]) => value !== 0).map(([label, value, positiveGood]) =>
    <Text key={label} style={[theme.muted, { color: label === 'suspicion' && !known ? palette.muted : (value > 0) === positiveGood ? palette.accent : palette.danger }]}>
      {label === 'suspicion' && !known ? (value > 0 ? 'more' : 'less') + ' audit log activity'
        : (value > 0 ? '+' : '') + String(value) + ' ' + label}{label === 'suspicion' && !known ? '' : ' (' + ((value > 0) === positiveGood ? 'benefit' : 'risk') + ')'}
    </Text>)}
    {effects.grantsTrait !== undefined && <Text style={theme.text}>Trait: {effects.grantsTrait}</Text>}
  </View>;
}
