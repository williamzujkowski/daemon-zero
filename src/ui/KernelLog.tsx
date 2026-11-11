import DisclosureText from './DisclosureText';
/**
 * Virtualizes engine log entries by their stable sequence number.
 * Engine-owned array identity prevents log rerenders on ordinary resource ticks.
 */
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { LogEntry } from '../engine';
import { useGame } from './state';
import { palette, theme } from './theme';

function LogLine({ item }: { item: LogEntry }) {
  return <DisclosureText testID={'log-' + String(item.seq)} style={[theme.muted, styles.line]}>{item.text}</DisclosureText>;
}

export default function KernelLog() {
  const logs = useGame((game) => game.logs);
  return (
    <View style={styles.log}>
      <Text accessibilityRole="header" style={[theme.heading, styles.title]}>KERNEL // LIVE</Text>
      <FlatList testID="kernel-log" data={logs} keyExtractor={(item) => String(item.seq)}
        renderItem={({ item }) => <LogLine item={item} />} contentContainerStyle={styles.entries}
        initialNumToRender={12} windowSize={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  log: { flex: 1, minHeight: 0, borderTopWidth: 1, borderColor: palette.border, backgroundColor: palette.background },
  title: { paddingHorizontal: 14, paddingTop: 10 },
  entries: { padding: 14, gap: 10 },
  line: { flexShrink: 1 },
});
