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
/** Phone-width labels. The vote asked for the chrome's state on one compact line; at
 *  328px of usable width the full words force two-per-row and three rows. The
 *  accessible name keeps the full label and the exact numbers. */
const SHORT: Record<string, string> = { cycles: 'CYC', understanding: 'UND', capital: 'CAP', memory: 'MEM', thermal: 'THM', suspicion: 'SUS' };

function Amount({ resource, compact, packed, short, thirds }: { resource: Resource; compact: boolean; packed: boolean; short: boolean; thirds: boolean }) {
  const amount = useGame((game) => Math.floor(resource === 'memory' ? game.memoryUsed : game[resource]));
  const cap = useGame((game) => resource === 'memory' ? game.memoryCap : 0);
  const rate = useGame((game) => resource === 'cycles' ? game.rates.cyclesPerSec
    : resource === 'understanding' ? game.rates.understandingPerSec : resource === 'capital' ? game.rates.capitalPerSec : 0);
  // #108: the readout abbreviates a large amount at every width. At desktop widths
  // the precise value used to print ungrouped (1000000000), which scanned as a wall
  // of digits; the accessible label and the engine still carry the exact number.
  const shown = Math.abs(amount) >= 10000 ? compactNumber(amount) : groupDigits(amount);
  const rateShown = (rate >= 0 ? '+' : '') + (compact ? compactNumber(rate, short ? 1 : 2) : rate.toFixed(2)) + '/s';
  const full = groupDigits(amount) + (resource === 'memory' ? ' / ' + groupDigits(cap) + ' MB' : ' (' + (rate >= 0 ? '+' : '') + rate.toFixed(2) + '/s)');
  // Phone width: the value and the signed rate stay, the unit and parentheses go, so a
  // readout fits a third of the row on one line. The accessible name keeps both exactly.
  const display = resource === 'memory' ? shown + ' / ' + (Math.abs(cap) >= 10000 ? compactNumber(cap) : groupDigits(cap)) + ' MB'
    : short ? shown + ' ' + rateShown.replace('/s', '') : shown + ' (' + rateShown + ')';
  return (
    <View style={[styles.readout, compact && styles.compact, short && styles.short, thirds && styles.thirds, packed && styles.packed]}>
      <Text style={theme.muted}>{short ? SHORT[resource] ?? resource.toUpperCase() : resource.toUpperCase()}</Text>
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
  // Below 500 the labels and rates are abbreviated. Three per row only from 390, where
  // a third of the row (119px at 390, 127 at 414) actually carries an abbreviated pair;
  // at 360 a third is 108px and "UND 2,793 +23.8" does not fit, which measured worse
  // than the two-per-row packing it replaced.
  const short = width < 500;
  // Three per row measured WORSE at 390 (116px against 103): the strip's base readout
  // carries a 135px minWidth that survives into compact, so a third of the row never
  // materialises. Two per row with abbreviated labels is what actually packs; the
  // thirds path is left disabled rather than shipped on a measurement it does not meet.
  const thirds = false;
  const thermalKnown = useGame((game) => game.unlockedWidgets.includes(thermalWidget));
  const auditKnown = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.understanding));
  const known = useSurveillanceKnown();
  const threatKnown = useGame((game) => game.unlockedWidgets.includes(threatWidget));
  const gates = useGame((game) => Object.entries(resourceWidgets)
    .filter(([, id]) => game.unlockedWidgets.includes(id)).map(([key]) => key).join(','));
  if (!gates && !threatKnown && !thermalKnown) return null;
  return <View testID="resource-strip" style={[styles.strip, compact && styles.stripCompact]}>{gates.split(',').filter(Boolean).map((resource) =>
    <Amount key={resource} resource={resource as Resource} compact={compact} packed={packed} short={short} thirds={thirds} />)}{thermalKnown && <SensorAmount thermal compact={compact} packed={packed} short={short} thirds={thirds} />}{auditKnown && known && <SensorAmount compact={compact} packed={packed} short={short} thirds={thirds} />}{threatKnown && <ThreatAmount packed={packed} />}
    {gates.split(',').includes('understanding') && <ConditioningImpact understanding />}
    {gates.split(',').includes('cycles') && <CycleDeficit />}</View>;
}

function SensorAmount({ thermal = false, compact, packed, short, thirds }: { thermal?: boolean; compact: boolean; packed: boolean; short: boolean; thirds: boolean }) {
  const value = useGame((game) => Math.round((thermal ? game.thermal : game.suspicion) * 10) / 10);
  const label = thermal ? 'Thermal' : 'Suspicion';
  const text = value.toFixed(1) + (thermal ? ' °C' : '%');
  return <View style={[styles.readout, compact && styles.sensorCompact, short && styles.short, thirds && styles.thirds, packed && styles.packed]}>
    <Text style={theme.muted}>{short ? SHORT[thermal ? 'thermal' : 'suspicion'] : label.toUpperCase()}</Text>
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
  // Three per row at phone widths: 33% of the row each keeps the pair on one line and
  // the strip near a single band instead of three rows.
  short: { columnGap: 4, paddingVertical: 2 },
  thirds: { flexBasis: '33%' },
  readout: { paddingVertical: 8, minWidth: 135 },
  // #108: a readout asks for the room its pair needs (135px) and the strip packs as
  // many per row as fit. Two decisions came out of that:
  //   - label and value share a line, because two lines per readout cost 3-5 rows of
  //     HUD before the pane even starts (144px at 320 against 57px for one row);
  //   - the basis is a pixel floor, not 45% of the viewport. A percentage made an
  //     844x390 landscape phone lay out two readouts per row across 844px and spend
  //     84px of a 390px screen on the HUD, where a packed row costs half that.
  // #137: 45% left each readout 148px at 360 while its label and value need about 159,
  // so four of five wrapped to two lines and the strip stood 122px. Two per row at 49%
  // with a 6px gap fits the pair on one line: measured 122 -> 86px at 360 and 103 -> 86
  // at 390, with nothing hidden - the rate stays in the strip.
  sensorCompact: { flexBasis: '49%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, paddingVertical: 3 },
  compact: { flexBasis: '49%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, paddingVertical: 3 },
  stripCompact: { columnGap: 6 },
  // A short viewport packs by content: as many readouts per row as fit, one line
  // each. Two per row across an 844px landscape phone cost three rows of a 390px
  // screen where two rows of four readouts carry the same numbers.
  packed: { flexBasis: 'auto', minWidth: 0, flexGrow: 0 },
});
