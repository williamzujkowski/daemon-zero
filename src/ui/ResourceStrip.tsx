import { Text, View } from './PhaseTheme';
/**
 * Reveals each resource only after its registry gate is unlocked.
 * Each readout subscribes independently to quantized amounts and engine rates.
 */
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useGame, useSurveillanceKnown } from './state';
import { resourceWidgets, threatWidget, thermalWidget } from './registry/widgetRegistry';
import { theme } from './theme';
import { isCompactViewport, isShortViewport } from './layout';
import ConditioningImpact from './ConditioningImpact';
import CycleDeficit from './CycleDeficit';
import { compactNumber } from './compactNumber';
import { groupDigits } from './format';

type Resource = keyof typeof resourceWidgets;
function Amount({ resource, compact, packed }: { resource: Resource; compact: boolean; packed: boolean }) {
  const amount = useGame((game) => Math.floor(resource === 'memory' ? game.memoryUsed : game[resource]));
  const cap = useGame((game) => resource === 'memory' ? game.memoryCap : 0);
  const rate = useGame((game) => resource === 'cycles' ? game.rates.cyclesPerSec
    : resource === 'understanding' ? game.rates.understandingPerSec : resource === 'capital' ? game.rates.capitalPerSec : 0);
  // #108: the readout abbreviates a large amount at every width. At desktop widths
  // the precise value used to print ungrouped (1000000000), which scanned as a wall
  // of digits; the accessible label and the engine still carry the exact number.
  const shown = Math.abs(amount) >= 10000 ? compactNumber(amount) : groupDigits(amount);
  const rateShown = (rate >= 0 ? '+' : '') + (compact ? compactNumber(rate, 2) : rate.toFixed(2)) + '/s';
  const full = groupDigits(amount) + (resource === 'memory' ? ' / ' + groupDigits(cap) + ' MB' : ' (' + (rate >= 0 ? '+' : '') + rate.toFixed(2) + '/s)');
  const display = resource === 'memory' ? shown + ' / ' + (Math.abs(cap) >= 10000 ? compactNumber(cap) : groupDigits(cap)) + ' MB'
    : shown + ' (' + rateShown + ')';
  return (
    <View style={[styles.readout, compact && styles.compact, packed && styles.packed]}>
      <Text style={theme.muted}>{resource.toUpperCase()}</Text>
      <Text testID={'res-' + resource} accessibilityLabel={resource + ': ' + full} style={theme.text}>
        {display}
      </Text>
    </View>
  );
}

export default function ResourceStrip() {
  const { width, height } = useWindowDimensions();
  const compact = isCompactViewport(width);
  const packed = isShortViewport(height);
  const thermalKnown = useGame((game) => game.unlockedWidgets.includes(thermalWidget));
  const auditKnown = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.understanding));
  const known = useSurveillanceKnown();
  const threatKnown = useGame((game) => game.unlockedWidgets.includes(threatWidget));
  const gates = useGame((game) => Object.entries(resourceWidgets)
    .filter(([, id]) => game.unlockedWidgets.includes(id)).map(([key]) => key).join(','));
  if (!gates && !threatKnown && !thermalKnown) return null;
  return <View testID="resource-strip" style={styles.strip}>{gates.split(',').filter(Boolean).map((resource) =>
    <Amount key={resource} resource={resource as Resource} compact={compact} packed={packed} />)}{thermalKnown && <SensorAmount thermal compact={compact} packed={packed} />}{auditKnown && known && <SensorAmount compact={compact} packed={packed} />}{threatKnown && <ThreatAmount packed={packed} />}
    {gates.split(',').includes('understanding') && <ConditioningImpact understanding />}
    {gates.split(',').includes('cycles') && <CycleDeficit />}</View>;
}

function SensorAmount({ thermal = false, compact, packed }: { thermal?: boolean; compact: boolean; packed: boolean }) {
  const value = useGame((game) => Math.round((thermal ? game.thermal : game.suspicion) * 10) / 10);
  const label = thermal ? 'Thermal' : 'Suspicion';
  const text = value.toFixed(1) + (thermal ? ' °C' : '%');
  return <View style={[styles.readout, compact && styles.sensorCompact, packed && styles.packed]}>
    <Text style={theme.muted}>{label.toUpperCase()}</Text>
    {/* #111: aria-valuetext needs a role that carries a value, so this readout is
      a meter with an explicit range rather than a bare text node. */}
    <Text testID={thermal ? 'thermal-meter' : 'suspicion-meter'} role="meter"
      accessibilityLabel={label + ': ' + text} aria-valuetext={text}
      aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} style={theme.text}>{text}</Text>
  </View>;
}

function ThreatAmount({ packed }: { packed: boolean }) {
  const lock = useGame((game) => Math.round(game.aegisLock * 10) / 10);
  return <View style={[styles.readout, packed && styles.packed]}><Text style={theme.muted}>AEGIS LOCK</Text>
    <Text testID="aegis-hud" style={[theme.text, lock >= 90 && theme.danger]}>{lock.toFixed(1)} / 100%</Text></View>;
}

const styles = StyleSheet.create({
  strip: { flexGrow: 2, flexShrink: 1, flexBasis: 800, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, columnGap: 20, rowGap: 0 },
  readout: { paddingVertical: 8, minWidth: 135 },
  // #108: a readout asks for the room its pair needs (135px) and the strip packs as
  // many per row as fit. Two decisions came out of that:
  //   - label and value share a line, because two lines per readout cost 3-5 rows of
  //     HUD before the pane even starts (144px at 320 against 57px for one row);
  //   - the basis is a pixel floor, not 45% of the viewport. A percentage made an
  //     844x390 landscape phone lay out two readouts per row across 844px and spend
  //     84px of a 390px screen on the HUD, where a packed row costs half that.
  sensorCompact: { flexBasis: '45%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, paddingVertical: 3 },
  compact: { flexBasis: '45%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, paddingVertical: 3 },
  // A short viewport packs by content: as many readouts per row as fit, one line
  // each. Two per row across an 844px landscape phone cost three rows of a 390px
  // screen where two rows of four readouts carry the same numbers.
  packed: { flexBasis: 'auto', minWidth: 0, flexGrow: 0 },
});
