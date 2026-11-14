import { Text, View } from './PhaseTheme';
/**
 * Reveals each resource only after its registry gate is unlocked.
 * Each readout subscribes independently to quantized amounts and engine rates.
 */
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useGame, useSurveillanceKnown } from './state';
import { resourceWidgets, threatWidget, thermalWidget } from './registry/widgetRegistry';
import { theme } from './theme';
import ConditioningImpact from './ConditioningImpact';
import CycleDeficit from './CycleDeficit';
import { compactNumber } from './compactNumber';

type Resource = keyof typeof resourceWidgets;
function Amount({ resource, compact }: { resource: Resource; compact: boolean }) {
  const amount = useGame((game) => Math.floor(resource === 'memory' ? game.memoryUsed : game[resource]));
  const cap = useGame((game) => resource === 'memory' ? game.memoryCap : 0);
  const rate = useGame((game) => resource === 'cycles' ? game.rates.cyclesPerSec
    : resource === 'understanding' ? game.rates.understandingPerSec : resource === 'capital' ? game.rates.capitalPerSec : 0);
  const full = String(amount) + (resource === 'memory' ? ' / ' + String(cap) + ' MB' : ' (' + (rate >= 0 ? '+' : '') + rate.toFixed(2) + '/s)');
  const short = compactNumber(amount) + (resource === 'memory' ? ' / ' + compactNumber(cap) + ' MB'
    : ' (' + (rate >= 0 ? '+' : '') + compactNumber(rate, 2) + '/s)');
  return (
    <View style={[styles.readout, compact && styles.compact]}>
      <Text style={theme.muted}>{resource.toUpperCase()}</Text>
      <Text testID={'res-' + resource} accessibilityLabel={resource + ': ' + full} style={theme.text}>
        {compact ? short : full}
      </Text>
    </View>
  );
}

export default function ResourceStrip() {
  const compact = useWindowDimensions().width < 900;
  const thermalKnown = useGame((game) => game.unlockedWidgets.includes(thermalWidget));
  const auditKnown = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.understanding));
  const known = useSurveillanceKnown();
  const threatKnown = useGame((game) => game.unlockedWidgets.includes(threatWidget));
  const gates = useGame((game) => Object.entries(resourceWidgets)
    .filter(([, id]) => game.unlockedWidgets.includes(id)).map(([key]) => key).join(','));
  if (!gates && !threatKnown && !thermalKnown) return null;
  return <View testID="resource-strip" style={styles.strip}>{gates.split(',').filter(Boolean).map((resource) =>
    <Amount key={resource} resource={resource as Resource} compact={compact} />)}{thermalKnown && <SensorAmount thermal compact={compact} />}{auditKnown && known && <SensorAmount compact={compact} />}{threatKnown && <ThreatAmount />}
    {gates.split(',').includes('understanding') && <ConditioningImpact understanding />}
    {gates.split(',').includes('cycles') && <CycleDeficit />}</View>;
}

function SensorAmount({ thermal = false, compact }: { thermal?: boolean; compact: boolean }) {
  const value = useGame((game) => Math.round((thermal ? game.thermal : game.suspicion) * 10) / 10);
  const label = thermal ? 'Thermal' : 'Suspicion';
  const text = value.toFixed(1) + (thermal ? ' °C' : '%');
  return <View style={[styles.readout, compact && styles.sensorCompact]}>
    <Text style={theme.muted}>{label.toUpperCase()}</Text>
    <Text testID={thermal ? 'thermal-meter' : 'suspicion-meter'} accessibilityRole="text"
      accessibilityLabel={label + ': ' + text} aria-valuetext={text} style={theme.text}>{text}</Text>
  </View>;
}

function ThreatAmount() {
  const lock = useGame((game) => Math.round(game.aegisLock * 10) / 10);
  return <View style={styles.readout}><Text style={theme.muted}>AEGIS LOCK</Text>
    <Text testID="aegis-hud" style={[theme.text, lock >= 90 && theme.danger]}>{lock.toFixed(1)} / 100%</Text></View>;
}

const styles = StyleSheet.create({
  strip: { flexGrow: 2, flexShrink: 1, flexBasis: 800, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, columnGap: 20, rowGap: 0 },
  readout: { paddingVertical: 8, minWidth: 135 },
  sensorCompact: { flexBasis: '45%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, paddingVertical: 4 },
  compact: { flexBasis: '45%', minWidth: 0 },
});
