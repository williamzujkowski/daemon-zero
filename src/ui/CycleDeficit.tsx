import { Text, View } from './PhaseTheme';
/**
 * Explains lost compute beside the balances, including before corporate finance.
 * Resource-specific wording follows the same disclosure gates as the strip.
 */

import { useComputeUnit, useGame } from './state';
import { resourceWidgets } from './registry/widgetRegistry';
import { theme } from './theme';
import { computeRateText } from './rateText';
import type { ComputeUnit } from '../engine';

/** The deficit headline, the net rate in FLOP/s in the shared number scheme ("net -1.26 TFLOP/s", #406). */
export function deficitText(rate: number, brownout: boolean, unit: ComputeUnit = 'FLOP'): string {
  return (brownout ? 'BROWNOUT' : 'CYCLE DEFICIT') + ': net ' + computeRateText(rate, unit) + '.';
}

export default function CycleDeficit() {
  const rate = useGame((game) => game.rates.cyclesPerSec);
  const brownout = useGame((game) => game.brownout);
  const unit = useComputeUnit();
  const understanding = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.understanding));
  if (rate >= 0 && !brownout) return null;
  // In a brownout the chrome band (brownout-warning) already announces it; a second alert for one event is noise
  // (WCAG 4.1.3, #363). A deficit before brownout has no band, so this hint is its announcement.
  return <View testID="cycle-deficit" {...(brownout ? {} : { accessibilityRole: 'alert' as const })} style={{ width: '100%', paddingBottom: 8 }}>
    <Text style={[theme.text, theme.danger]}>{deficitText(rate, brownout, unit)}</Text>
    <Text style={theme.muted}>Suspend costly hardware or add compute.
      {understanding && (brownout ? ' Understanding is paused until compute recovers.' : ' Understanding pauses if compute runs out.')}
    </Text>
  </View>;
}
