/** One scrollable pane renders only the unlocked manifest slots requested by its layout. */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../content';
import ManualCycle from './ManualCycle';
import NodeList from './NodeList';
import Repeatables from './Repeatables';
import { guestPinnedWidgets, widgetRegistry } from './registry/widgetRegistry';
import { useGame, useWidgetIds } from './state';
import { theme } from './theme';

/** Hardware of every phase hosted in the core pane, newest first, available before owned. */
function CoreTree() {
  const current = useGame((game) => game.currentPhase);
  const phases = CONTENT.phases.filter((phase) => phase.uiSlot === 'CORE' && phase.phaseId <= current)
    .map((phase) => phase.phaseId).sort((left, right) => right - left);
  return <>
    <ManualCycle />
    {phases.map((phase) => <NodeList key={'open-' + String(phase)} phase={phase} owned={false} />)}
    {phases.map((phase) => <Repeatables key={'rep-' + String(phase)} phase={phase} />)}
    {phases.map((phase) => <NodeList key={'owned-' + String(phase)} phase={phase} owned />)}
  </>;
}

export default function TerminalPane({ slots }: { slots: string[] }) {
  const ids = useWidgetIds();
  const phase = useGame((game) => game.currentPhase);
  const pinned = slots.includes('CORE') && phase === CONTENT.phases[0]?.phaseId
    ? ids.filter((id) => guestPinnedWidgets.includes(id)) : [];
  return <View style={styles.pane}>
    {pinned.length > 0 && <View testID="guest-console" style={styles.pinned}>
      {pinned.map((id) => <Widget key={id} id={id} compact />)}
    </View>}
    <ScrollView testID={'pane-scroll-' + slots.join('-')} style={styles.pane} contentContainerStyle={styles.content}>
    {slots.includes('CORE') && <CoreTree />}
    {ids.filter((id) => !pinned.includes(id) && slots.includes(CONTENT.widgets.get(id)?.slot ?? ''))
      .map((id) => <Widget key={id} id={id} />)}
    </ScrollView>
  </View>;
}

function Widget({ id, compact = false }: { id: string; compact?: boolean }) {
  const widget = CONTENT.widgets.get(id), Component = widgetRegistry[id];
  return widget && Component ? <View testID={'widget-' + id} style={compact ? styles.compact : theme.panel}>
    {!compact && <Text style={theme.heading}>{widget.title}</Text>}<Component />
  </View> : null;
}
const styles = StyleSheet.create({
  pane: { flex: 1, minWidth: 0, minHeight: 0 }, content: { padding: 16, gap: 14 },
  pinned: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#315c3b', gap: 8 },
  compact: { gap: 4 },
});
