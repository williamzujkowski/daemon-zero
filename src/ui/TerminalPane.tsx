/** One scrollable pane renders only the unlocked manifest slots requested by its layout. */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../content';
import ManualCycle from './ManualCycle';
import NodeList from './NodeList';
import Repeatables from './Repeatables';
import { widgetRegistry } from './registry/widgetRegistry';
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
  return <ScrollView style={styles.pane} contentContainerStyle={styles.content}>
    {slots.includes('CORE') && <CoreTree />}
    {ids.map((id) => {
      const widget = CONTENT.widgets.get(id), Component = widgetRegistry[id];
      return widget && Component && slots.includes(widget.slot) ? <View key={id} testID={'widget-' + id} style={theme.panel}>
        <Text style={theme.heading}>{widget.title}</Text><Component />
      </View> : null;
    })}
  </ScrollView>;
}
const styles = StyleSheet.create({ pane: { flex: 1, minWidth: 0, minHeight: 0 }, content: { padding: 16, gap: 14 } });
