import { Text, View } from './PhaseTheme';
/**
 * Explains lost compute beside the balances, including before corporate finance.
 * Resource-specific wording follows the same disclosure gates as the strip.
 */

import { useGame } from './state';
import { resourceWidgets } from './registry/widgetRegistry';
import { theme } from './theme';

export default function CycleDeficit() {
  const rate = useGame((game) => game.rates.cyclesPerSec);
  const brownout = useGame((game) => game.brownout);
  const understanding = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.understanding));
  if (rate >= 0 && !brownout) return null;
  return <View testID="cycle-deficit" accessibilityRole="alert" style={{ width: '100%', paddingBottom: 8 }}>
    <Text style={[theme.text, theme.danger]}>{brownout ? 'BROWNOUT' : 'CYCLE DEFICIT'}: net {rate.toFixed(2)} cycles/s.</Text>
    <Text style={theme.muted}>Suspend costly hardware or add compute.
      {understanding && (brownout ? ' Understanding is paused until compute recovers.' : ' Understanding pauses if cycles run out.')}
    </Text>
  </View>;
}
