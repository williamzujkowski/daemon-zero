import { Pressable, Text, View } from './PhaseTheme';
/**
 * Responsive terminal: one mobile pane with a log drawer, three desktop columns.
 * Navigation and frames derive from unlocked registry widgets, never future content.
 */
import { useState } from 'react';
import { Platform, StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import { CONTENT } from '../content';
import { selectNotice, selectReady, useGameValue } from '../app/selectors';
import { useGameLoop } from '../app/useGameLoop';
import LogDock from './LogDock';
import ResourceStrip from './ResourceStrip';
import { useGame, useWidgetIds } from './state';
import { PhaseTheme } from './PhaseTheme';
import { palette, theme } from './theme';
import DilemmaModal from './DilemmaModal';
import RebootSequence from './RebootSequence';
import Pane from './TerminalPane';
import EndingScreen from './EndingScreen';
import DevelopmentTools from '../app/DevelopmentTools';
import CheckpointLabel from './CheckpointLabel';
import LineageReveal from './LineageReveal';
import BlindAuditStatus from './BlindAuditStatus';
import SaveTransfer from './SaveTransfer';
import RunStatus from './RunStatus';
import ResponseNotice from './ResponseNotice';
import OmenNotice from './OmenNotice';
import PhaseThreshold from './PhaseThreshold';
import ProcessManager from './ProcessManager';

function Tabs({ slots, active, select }: { slots: string[]; active: string; select: (slot: string) => void }) {
  if (slots.length < 2) return null;
  return <View testID="terminal-tabs" style={styles.tabs}>{slots.map((slot) =>
    <Pressable key={slot} testID={'tab-' + slot} accessibilityRole="tab" accessibilityLabel={slot.toLowerCase() + ' pane'}
      accessibilityState={{ selected: slot === active }} aria-selected={slot === active}
      style={[styles.tab, slot === active && styles.selected]}
      onPress={() => { select(slot); }}><Text style={theme.muted}>{slot}</Text></Pressable>)}</View>;
}

function ThirdColumn({ slots }: { slots: string[] }) {
  const phase = useGame((game) => game.currentPhase);
  const preferred = phase >= CONTENT.balance.corporatePhase ? 'CORP' : 'NETWORK';
  const [selection, select] = useState<{ phase: number; slot: string }>({ phase, slot: preferred });
  if (selection.phase !== phase) select({ phase, slot: preferred });
  const available = slots.filter((slot) => slot === 'NETWORK' || slot === 'CORP');
  const active = available.some((slot) => slot === selection.slot) ? selection.slot : available[0] ?? 'NETWORK';
  return <View style={[styles.third, { flex: available.length > 0 ? 2 : 1 }]}>
    <Tabs slots={available} active={active} select={(slot) => { select({ phase, slot }); }} />
    {available.length > 0 && <Pane slots={[active]} />}<LogDock fill={available.length === 0} />
  </View>;
}

export default function TerminalScreen() {
  return <PhaseTheme><Terminal /></PhaseTheme>;
}

function Terminal() {
  useGameLoop();
  const { width } = useWindowDimensions();
  const ids = useWidgetIds();
  const slots = ['CORE', ...new Set(ids.flatMap((id) => CONTENT.widgets.get(id)?.slot ?? []).filter((slot) => slot !== 'CORE'))];
  const phase = useGame((game) => game.currentPhase);
  const preferred = CONTENT.phases.find((entry) => entry.phaseId === phase)?.uiSlot ?? 'CORE';
  const [selection, select] = useState<{ phase: number; slot: string }>({ phase, slot: preferred });
  if (selection.phase !== phase) select({ phase, slot: preferred });
  const active = slots.includes(selection.slot) ? selection.slot : 'CORE';
  const ready = useGameValue(selectReady);
  const notice = useGameValue(selectNotice);
  const ended = useGame((game) => game.ending !== null);
  if (ended) return <View style={styles.screen}><EndingScreen /></View>;
  return <View testID="terminal-screen" aria-busy={!ready} style={styles.screen}>
    <StatusBar barStyle="light-content" />
    <View style={styles.header}><View style={{ flexGrow: 1, flexBasis: 120, minWidth: 120 }}><Text style={theme.heading}>DAEMON // 0</Text>
      <CheckpointLabel /><RunStatus /></View><ProcessManager /><SaveTransfer /><DevelopmentTools /></View>
    {notice !== null && <Text testID="save-notice" accessibilityRole="alert" style={[theme.text, styles.notice]}>{notice}</Text>}
    <ResourceStrip />
    <BlindAuditStatus />
    <ResponseNotice /><OmenNotice />
    {width >= 900 ? <View testID="terminal-columns" style={styles.columns}>
      <View style={{ flex: preferred === 'CORE' ? 2 : 1, minWidth: 0 }}><Pane slots={['CORE']} /></View>
      {slots.some((slot) => slot === 'SENSORS' || slot === 'CONTINGENCY') && <Pane slots={['SENSORS', 'CONTINGENCY']} />}
      <ThirdColumn slots={slots} />
    </View> : <View testID="terminal-mobile" style={styles.mobile}>
      <Pane slots={[active]} /><LogDock mobile />
      <Tabs slots={slots} active={active} select={(slot) => { select({ phase, slot }); }} />
    </View>}
    <DilemmaModal />
    <PhaseThreshold />
    <LineageReveal />
    <RebootSequence />
    <EndingScreen />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: palette.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: palette.border },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  third: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderColor: palette.border },
  mobile: { flex: 1, minHeight: 0 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: palette.border },
  tab: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', flexGrow: 1, alignItems: 'center' },
  selected: { backgroundColor: palette.raised, borderTopWidth: 2, borderColor: palette.accent },
  notice: { padding: 12, color: palette.warning },
});
