/** One scrollable pane renders only the unlocked manifest slots requested by its layout. */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../content';
import ManualCycle from './ManualCycle';
import NodeList from './NodeList';
import Repeatables from './Repeatables';
import { widgetRegistry } from './registry/widgetRegistry';
import { useWidgetIds } from './state';
import { theme } from './theme';

export default function TerminalPane({ slots }: { slots: string[] }) {
  const ids = useWidgetIds();
  return <ScrollView style={styles.pane} contentContainerStyle={styles.content}>
    {slots.includes('CORE') && <><ManualCycle /><NodeList owned={false} /><Repeatables /><NodeList owned /></>}
    {ids.map((id) => {
      const widget = CONTENT.widgets.get(id), Component = widgetRegistry[id];
      return widget && Component && slots.includes(widget.slot) ? <View key={id} testID={'widget-' + id} style={theme.panel}>
        <Text style={theme.heading}>{widget.title}</Text><Component />
      </View> : null;
    })}
  </ScrollView>;
}
const styles = StyleSheet.create({ pane: { flex: 1, minWidth: 0, minHeight: 0 }, content: { padding: 16, gap: 14 } });
