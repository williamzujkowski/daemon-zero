/** Mobile navigation stays one reachable row; active destinations scroll into view. */
import { useEffect, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Pressable, Text, View } from './PhaseTheme';
import { palette, theme } from './theme';

export default function TerminalTabs({ slots, active, select, horizontal = false }: {
  slots: string[]; active: string; select: (slot: string) => void; horizontal?: boolean;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<string, number>>({});
  useEffect(() => { scroll.current?.scrollTo({ x: positions.current[active] ?? 0, animated: false }); }, [active]);
  if (slots.length < 2) return null;
  const tabs = <View testID="terminal-tabs" style={[styles.tabs, horizontal && { flexWrap: 'nowrap', flexGrow: 1, flexShrink: 0 }]}>{slots.map((slot) =>
    <Pressable key={slot} testID={'tab-' + slot} accessibilityRole="tab" accessibilityLabel={slot.toLowerCase() + ' pane'}
      accessibilityState={{ selected: slot === active }} aria-selected={slot === active}
      onLayout={(event) => {
        positions.current[slot] = event.nativeEvent.layout.x;
        if (slot === active) scroll.current?.scrollTo({ x: event.nativeEvent.layout.x, animated: false });
      }} style={[styles.tab, horizontal && { flexGrow: 0 }, slot === active && styles.selected]}
      onPress={() => { select(slot); }}><Text style={theme.muted}>{slot}</Text></Pressable>)}</View>;
  return horizontal ? <ScrollView ref={scroll} testID="terminal-tabs-scroll" horizontal style={{ flexGrow: 0, flexShrink: 0 }}
    contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{tabs}</ScrollView> : tabs;
}
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: palette.border },
  tab: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', flexGrow: 1, alignItems: 'center' },
  selected: { backgroundColor: palette.raised, borderTopWidth: 2, borderColor: palette.accent },
});
