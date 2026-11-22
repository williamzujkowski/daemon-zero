import { Text, View } from '../PhaseTheme';
/** The AEGIS lock meter, its scan rate and the near-strike warning: the console's own threat readout. */
import { useGame } from '../state';
import { theme } from '../theme';
import { aegisCritical } from '../registry/widgetRegistry';
import Meter from './Meter';

export default function AegisStatus() {
  const lock = useGame((game) => Math.round(game.aegisLock * 10) / 10);
  const rate = useGame((game) => game.rates.aegisScanPerSec);
  return <View style={{ gap: 8 }}>
    <Meter id="aegis-lock" label="AEGIS lock" value={lock} unit="%" />
    <Text style={theme.muted}>Scan rate: {rate.toFixed(3)} /s</Text>
    {aegisCritical(lock) && <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>WARNING: hunter lock near completion.</Text>}
  </View>;
}
