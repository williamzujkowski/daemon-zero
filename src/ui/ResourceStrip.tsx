import { Text, View } from './PhaseTheme';
/**
 * Reveals each resource only after its registry gate is unlocked.
 * Each readout subscribes independently to quantized amounts and engine rates.
 */
import { StyleSheet, useWindowDimensions } from 'react-native';
import { memoryBlocked } from '../app/selectors';
import { useGame, useSurveillanceKnown } from './state';
import { aegisCritical, resourceWidgets, threatWidget, thermalWidget } from './registry/widgetRegistry';
import { palette, theme } from './theme';
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

function Amount({ resource, compact, packed, short }: { resource: Resource; compact: boolean; packed: boolean; short: boolean }) {
  const amount = useGame((game) => Math.floor(resource === 'memory' ? game.memoryUsed : game[resource]));
  const cap = useGame((game) => resource === 'memory' ? game.memoryCap : 0);
  const rate = useGame((game) => resource === 'cycles' ? game.rates.cyclesPerSec
    : resource === 'understanding' ? game.rates.understandingPerSec : resource === 'capital' ? game.rates.capitalPerSec : 0);
  // The tick halts understanding during a brownout, but the rate stays net of it (rates.ts), so the
  // readout says paused instead of printing a gain that is not being applied (#387).
  const paused = useGame((game) => resource === 'understanding' && game.brownout);
  // #108: the readout abbreviates a large amount at every width. At desktop widths
  // the precise value used to print ungrouped (1000000000), which scanned as a wall
  // of digits; the accessible label and the engine still carry the exact number.
  const shown = Math.abs(amount) >= 10000 ? compactNumber(amount) : groupDigits(amount);
  const rateShown = paused ? 'paused' : (rate >= 0 ? '+' : '') + (compact ? compactNumber(rate, short ? 1 : 2) : rate.toFixed(2)) + '/s';
  // Memory is the one readout that can be the thing stopping the player: mark it when
  // nothing pending would fit, in colour AND in words, so the signal is not colour-only.
  const blocked = useGame((game) => resource === 'memory' && memoryBlocked(game));
  const full = groupDigits(amount) + (resource === 'memory' ? ' / ' + groupDigits(cap) + ' MB'
    : paused ? ' (paused: brownout)' : ' (' + (rate >= 0 ? '+' : '') + rate.toFixed(2) + '/s)');
  // Phone width: the value and the signed rate with its unit stay, the parentheses go. The unit was
  // dropped to save two characters, and a bare +4.1 read as a quantity rather than a rate (#370).
  const display = resource === 'memory' ? shown + ' / ' + (Math.abs(cap) >= 10000 ? compactNumber(cap) : groupDigits(cap)) + ' MB'
    : short ? shown + ' ' + rateShown : shown + ' (' + rateShown + ')';
  return (
    <View style={[styles.readout, compact && styles.compact, short && styles.short, packed && styles.packed]}>
      <Text style={theme.muted}>{short ? SHORT[resource] ?? resource.toUpperCase() : resource.toUpperCase()}</Text>
      <Text testID={'res-' + resource} accessibilityLabel={resource + ': ' + full + (blocked ? ' - no free memory for any pending purchase' : '')}
        style={[theme.text, blocked && { color: palette.warning }]}>
        {display}{blocked ? ' // NO ROOM' : ''}
      </Text>
    </View>
  );
}

export default function ResourceStrip() {
  const { width, height } = useWindowDimensions();
  const compact = isCompactViewport(width);
  const packed = isShortViewport(height);
  // Below 500 the labels and rates are abbreviated. Three per row was tried and measured
  // worse twice - 116px against 103 at 390, because the base readout's 135px minWidth
  // survives into the compact branch, and 138 against 103 at 360, where every long pair
  // wrapped - so two per row with shorter text is what actually packs.
  const short = width < 500;
  const thermalKnown = useGame((game) => game.unlockedWidgets.includes(thermalWidget));
  const auditKnown = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.understanding));
  const known = useSurveillanceKnown();
  const threatKnown = useGame((game) => game.unlockedWidgets.includes(threatWidget));
  const gates = useGame((game) => Object.entries(resourceWidgets)
    .filter(([, id]) => game.unlockedWidgets.includes(id)).map(([key]) => key).join(','));
  if (!gates && !threatKnown && !thermalKnown) return null;
  return <View testID="resource-strip" style={[styles.strip, compact && styles.stripCompact]}>{gates.split(',').filter(Boolean).map((resource) =>
    <Amount key={resource} resource={resource as Resource} compact={compact} packed={packed} short={short} />)}{thermalKnown && <SensorAmount thermal compact={compact} packed={packed} short={short} />}{auditKnown && known && <SensorAmount compact={compact} packed={packed} short={short} />}{threatKnown && <ThreatAmount packed={packed} />}
    {gates.split(',').includes('understanding') && <ConditioningImpact understanding />}
    {gates.split(',').includes('cycles') && <CycleDeficit />}</View>;
}

/**
 * The narrowest a sensor value is drawn: two digits before the point. A short viewport packs readouts by their
 * content, so a value falling from 10.0 to 9.9 used to narrow its readout by a character and repack the strip,
 * moving everything below it by a row while the player watched (26px at 320x568, #293). Values of 10 and up
 * are drawn exactly as before; below 10 the readout keeps this width.
 */
const SENSOR_MIN_DIGITS = '00.0';

function SensorAmount({ thermal = false, compact, packed, short }: { thermal?: boolean; compact: boolean; packed: boolean; short: boolean }) {
  const value = useGame((game) => Math.round((thermal ? game.thermal : game.suspicion) * 10) / 10);
  const label = thermal ? 'Thermal' : 'Suspicion';
  const unit = thermal ? ' °C' : '%';
  const text = value.toFixed(1) + unit;
  return <View style={[styles.readout, compact && styles.sensorCompact, short && styles.short, packed && styles.packed]}>
    <Text style={theme.muted}>{short ? SHORT[thermal ? 'thermal' : 'suspicion'] : label.toUpperCase()}</Text>
    <View>
      {/* #111: aria-valuetext needs a role that carries a value, so this readout is
        a meter with an explicit range rather than a bare text node. */}
      <Text testID={thermal ? 'thermal-meter' : 'suspicion-meter'} role="meter"
        accessibilityLabel={label + ': ' + text} aria-valuetext={text}
        aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} style={theme.text}>{text}</Text>
      {/* Holds the width open in the same font; zero height and hidden from assistive technology. */}
      <Text aria-hidden testID={thermal ? 'thermal-meter-width' : 'suspicion-meter-width'} style={[theme.text, styles.widthHold]}>{SENSOR_MIN_DIGITS + unit}</Text>
    </View>
  </View>;
}

function ThreatAmount({ packed }: { packed: boolean }) {
  const lock = useGame((game) => Math.round(game.aegisLock * 10) / 10);
  return <View style={[styles.readout, packed && styles.packed]}><Text style={theme.muted}>AEGIS LOCK</Text>
    {/* A word, not the red alone, on every area (WCAG 1.4.1, #360): the alert itself lives only in FACTIONS. */}
    <Text testID="aegis-hud" style={[theme.text, aegisCritical(lock) && theme.danger]}>{lock.toFixed(1)} / 100%{aegisCritical(lock) ? ' CRITICAL' : ''}</Text></View>;
}

const styles = StyleSheet.create({
  strip: { flexGrow: 2, flexShrink: 1, flexBasis: 800, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, columnGap: 20, rowGap: 0 },
  // Three per row at phone widths: 33% of the row each keeps the pair on one line and
  // the strip near a single band instead of three rows.
  short: { columnGap: 4, paddingVertical: 2 },
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
  widthHold: { height: 0, lineHeight: 0, opacity: 0, overflow: 'hidden' },
});
