/**
 * Reveals each resource only after its registry gate is unlocked.
 * Each readout subscribes independently to quantized amounts and engine rates.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useGame } from './state';
import { resourceWidgets, threatWidget } from './registry/widgetRegistry';
import { palette, theme } from './theme';

type Resource = keyof typeof resourceWidgets;
function Amount({ resource }: { resource: Resource }) {
  const amount = useGame((game) => Math.floor(resource === 'memory' ? game.memoryUsed : game[resource]));
  const cap = useGame((game) => resource === 'memory' ? game.memoryCap : 0);
  const rate = useGame((game) => resource === 'cycles' ? game.rates.cyclesPerSec
    : resource === 'understanding' ? game.rates.understandingPerSec : resource === 'capital' ? game.rates.capitalPerSec : 0);
  return (
    <View style={styles.readout}>
      <Text style={theme.muted}>{resource.toUpperCase()}</Text>
      <Text testID={'res-' + resource} style={theme.text}>
        {amount}{resource === 'memory' ? ' / ' + String(cap) + ' MB' : ' (' + (rate >= 0 ? '+' : '') + rate.toFixed(2) + '/s)'}
      </Text>
    </View>
  );
}

export default function ResourceStrip() {
  const threatKnown = useGame((game) => game.unlockedWidgets.includes(threatWidget));
  const gates = useGame((game) => Object.entries(resourceWidgets)
    .filter(([, id]) => game.unlockedWidgets.includes(id)).map(([key]) => key).join(','));
  if (!gates && !threatKnown) return null;
  return <View testID="resource-strip" style={styles.strip}>{gates.split(',').filter(Boolean).map((resource) =>
    <Amount key={resource} resource={resource as Resource} />)}{threatKnown && <ThreatAmount />}</View>;
}

function ThreatAmount() {
  const lock = useGame((game) => Math.round(game.aegisLock * 10) / 10);
  return <View style={styles.readout}><Text style={theme.muted}>AEGIS LOCK</Text>
    <Text testID="aegis-hud" style={[theme.text, lock >= 90 && theme.danger]}>{lock.toFixed(1)} / 100%</Text></View>;
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderColor: palette.border, paddingHorizontal: 16, gap: 20 },
  readout: { paddingVertical: 10, minWidth: 135 },
});
