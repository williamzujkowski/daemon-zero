import { Text, View } from './PhaseTheme';
/** Consequence badges use signed numbers and explicit labels as well as colour. */

import type { EffectPayload } from '../content/schema';
import { CONTENT } from '../content';
import { useComputeUnit, useSurveillanceKnown } from './state';
import { palette, theme } from './theme';
import { amountFigure } from './format';
import { costPart, type ComputeUnit } from '../engine';
import { traitWithGloss } from './traitText';

/**
 * A one-shot effect, exact as authored: compute and capital in their units ("+45 TFLOP compute", "+$20M capital"),
 * memory capacity in bytes ("+512 GB memory capacity"), other amounts in K/M/B (#404). Counted cycles name themselves
 ("+150 cycles", #526).
 */
function effectFigure(label: string, value: number, unit: ComputeUnit): string {
  if (label === 'compute') return costPart('cycles', value, unit) + (unit === 'CYCLE' ? '' : ' ' + label);
  if (label === 'capital') return costPart('capital', value) + ' ' + label;
  if (label === 'memory capacity') return costPart('memory', value) + ' ' + label;
  return amountFigure(value) + ' ' + label;
}

export default function Effects({ effects }: { effects: EffectPayload }) {
  const known = useSurveillanceKnown();
  const unit = useComputeUnit();
  const rows: [string, number, boolean][] = [
    ['compute', effects.cyclesDelta, true], ['understanding', effects.understandingDelta, true],
    ['capital', effects.capitalDelta, true], ['thermal °C', effects.thermalDelta, false],
    ['suspicion', effects.suspicionDelta, false], ['AEGIS lock', effects.aegisLockDelta, false],
    ['memory capacity', effects.memoryCapIncrease, true],
    ['epistemic drift', effects.epistemicDriftDelta ?? 0, false],
    ...Object.entries(effects.trustDelta).map(([id, value]): [string, number, boolean] =>
      [(CONTENT.factions.get(id)?.name ?? 'Peer') + ' trust', value, true]),
  ];
  return <View>{rows.filter(([, value]) => value !== 0).map(([label, value, positiveGood]) =>
    <Text key={label} style={[theme.muted, { color: label === 'suspicion' && !known ? palette.muted : (value > 0) === positiveGood ? palette.accent : palette.danger }]}>
      {label === 'suspicion' && !known ? (value > 0 ? 'more' : 'less') + ' audit log activity'
        : (value > 0 ? '+' : '') + effectFigure(label, value, unit)}{label === 'suspicion' && !known ? '' : ' (' + ((value > 0) === positiveGood ? 'benefit' : 'risk') + ')'}
    </Text>)}
    {effects.grantsTrait !== undefined && <Text testID="effect-trait" style={theme.text}>Trait: {traitWithGloss(effects.grantsTrait)}</Text>}
  </View>;
}
