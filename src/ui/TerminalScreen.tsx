/**
 * Responsive terminal: one mobile pane with a log drawer, three desktop columns.
 * Navigation and frames derive from unlocked registry widgets, never future content.
 */
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CONTENT } from '../content';
import { selectNotice, useGameValue } from '../app/selectors';
import { useGameLoop } from '../app/useGameLoop';
import KernelLog from './KernelLog';
import ManualCycle from './ManualCycle';
import NodeList from './NodeList';
import Repeatables from './Repeatables';
import ResourceStrip from './ResourceStrip';
import { useGame, useWidgetIds } from './state';
import { palette, theme } from './theme';

function Slots({ slots }: { slots: string[] }) {
  const ids = useWidgetIds();
  return <>{ids.map((id) => {
    const widget = CONTENT.widgets.get(id);
    return widget && slots.includes(widget.slot) ? <View key={id} style={theme.panel}>
      <Text style={theme.heading}>{widget.title}</Text>
    </View> : null;
  })}</>;
}

function Pane({ slots }: { slots: string[] }) {
  return <ScrollView style={styles.pane} contentContainerStyle={styles.paneContent}>
    {slots.includes('CORE') && <><ManualCycle /><NodeList owned={false} /><Repeatables /><NodeList owned /></>}
    <Slots slots={slots} />
  </ScrollView>;
}

function Tabs({ slots, active, select }: { slots: string[]; active: string; select: (slot: string) => void }) {
  if (slots.length < 2) return null;
  return <View testID="terminal-tabs" style={styles.tabs}>{slots.map((slot) =>
    <Pressable key={slot} testID={'tab-' + slot} accessibilityRole="tab" accessibilityLabel={slot.toLowerCase() + ' pane'}
      accessibilityState={{ selected: slot === active }} aria-selected={slot === active}
      style={[styles.tab, slot === active && styles.selected]}
      onPress={() => { select(slot); }}><Text style={theme.muted}>{slot}</Text></Pressable>)}</View>;
}

export default function TerminalScreen() {
  useGameLoop();
  const { width } = useWindowDimensions();
  const ids = useWidgetIds();
  const slots = ['CORE', ...new Set(ids.flatMap((id) => CONTENT.widgets.get(id)?.slot ?? []).filter((slot) => slot !== 'CORE'))];
  const [selected, select] = useState('CORE');
  const active = slots.includes(selected) ? selected : 'CORE';
  const iteration = useGame((game) => game.iteration);
  const notice = useGameValue(selectNotice);
  return <View testID="terminal-screen" style={styles.screen}>
    <StatusBar barStyle="light-content" />
    <View style={styles.header}><Text style={theme.heading}>DAEMON // 0</Text>
      <Text style={theme.muted}>ITERATION {String(iteration).padStart(2, '0')}</Text></View>
    {notice !== null && <Text testID="save-notice" accessibilityRole="alert" style={[theme.text, styles.notice]}>{notice}</Text>}
    <ResourceStrip />
    {width >= 900 ? <View testID="terminal-columns" style={styles.columns}>
      <Pane slots={['CORE']} /><Pane slots={['SENSORS', 'CONTINGENCY']} />
      <View style={styles.third}><Pane slots={['NETWORK', 'CORP']} /><View style={styles.desktopLog}><KernelLog /></View></View>
    </View> : <View testID="terminal-mobile" style={styles.mobile}>
      <Pane slots={[active]} /><View style={styles.mobileLog}><KernelLog /></View>
      <Tabs slots={slots} active={active} select={select} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: palette.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { minHeight: 64, paddingHorizontal: 16, justifyContent: 'center', borderBottomWidth: 1, borderColor: palette.border },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  pane: { flex: 1, minWidth: 0, minHeight: 0 },
  paneContent: { padding: 16, gap: 14 },
  third: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderColor: palette.border },
  desktopLog: { height: 300 },
  mobile: { flex: 1, minHeight: 0 },
  mobileLog: { height: 180 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: palette.border },
  tab: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', flexGrow: 1, alignItems: 'center' },
  selected: { backgroundColor: palette.raised, borderTopWidth: 2, borderColor: palette.accent },
  notice: { padding: 12, color: palette.warning },
});
