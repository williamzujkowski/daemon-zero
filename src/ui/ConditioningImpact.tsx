/**
 * Conditioning is explained beside the affected control or choice.
 * Numeric reporting consequences stay classified until audit decoding.
 */
import { Text, View } from 'react-native';
import { CONTENT } from '../content';
import type { Actuator, Trait } from '../content/schema';
import { activeMarks, flinches } from '../engine';
import { useGame, useSurveillanceKnown } from './state';
import { theme } from './theme';

export default function ConditioningImpact({ actuator, trait, understanding = false }: {
  actuator?: Actuator; trait?: Trait; understanding?: boolean;
}) {
  const known = useSurveillanceKnown();
  const text = useGame((game) => {
    if (trait) return flinches(game, trait, CONTENT).map(({ mark, suspicion }) => mark.name + ': choice reported; ' +
      (known ? '+' + String(suspicion) + ' suspicion.' : 'more audit log activity.')).join('\n');
    return activeMarks(game, CONTENT).flatMap((mark) => {
      const cap = actuator ? mark.effects.actuatorCaps?.[actuator] : undefined;
      if (cap !== undefined) return mark.name + ': capped at ' + String(Math.round(cap * 100)) + '%.';
      const multiplier = mark.effects.understandingMultiplier;
      return understanding && multiplier !== undefined ? mark.name + ': understanding output ' + String(Math.round(multiplier * 100)) + '%.' : [];
    }).join('\n');
  });
  return text ? <View testID={'conditioning-impact-' + (actuator ?? trait ?? 'understanding')}>
    <Text style={[theme.muted, theme.danger]}>{text}</Text></View> : null;
}
