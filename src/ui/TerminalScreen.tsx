import { Text, View } from './PhaseTheme';
/**
 * Responsive terminal: mobile scroll flow and desktop panes beneath a compact HUD.
 * Navigation and frames derive from unlocked registry widgets, never future content.
 */
import { useState } from 'react';
import { Platform, StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import { CONTENT } from '../content';
import { selectNotice, selectReady, useGameValue } from '../app/selectors';
import { useGameLoop } from '../app/useGameLoop';
import { useMusicRuntime } from '../app/musicSession';
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
import GameMenu from './GameMenu';
import RunStatus from './RunStatus';
import ResponseNotice from './ResponseNotice';
import OmenNotice from './OmenNotice';
import PhaseThreshold from './PhaseThreshold';
import ProcessManager from './ProcessManager';
import Tabs from './TerminalTabs';
import MobileTerminal from './MobileTerminal';
import { UtilityFocusProvider } from './UtilityFocus';

function ThirdColumn({ slots }: { slots: string[] }) {
  const phase = useGame((game) => game.currentPhase);
  const preferred = phase >= CONTENT.balance.corporatePhase ? 'CORP' : 'NETWORK';
  const [selection, select] = useState<{ phase: number; slot: string }>({ phase, slot: preferred });
  if (selection.phase !== phase) select({ phase, slot: preferred });
  const available = slots.filter((slot) => slot === 'NETWORK' || slot === 'CORP');
  const active = available.some((slot) => slot === selection.slot) ? selection.slot : available[0] ?? 'NETWORK';
  if (available.length === 0) return null;
  return <View style={[styles.third, { flex: 2 }]}>
    <Tabs slots={available} active={active} select={(slot) => { select({ phase, slot }); }} />
    {available.length > 0 && <Pane slots={[active]} />}
  </View>;
}

export default function TerminalScreen() {
  useGameLoop();
  useMusicRuntime();
  const restoreRevision = useGameValue((state) => state.restoreRevision);
  // Replacement saves own fresh presentation state; the runtime keeps its single lease.
  return <PhaseTheme><UtilityFocusProvider><Terminal key={restoreRevision} /></UtilityFocusProvider></PhaseTheme>;
}

function Terminal() {
  const { width } = useWindowDimensions();
  const ids = useWidgetIds();
  const slots = ['CORE', ...new Set(ids.flatMap((id) => CONTENT.widgets.get(id)?.slot ?? []).filter((slot) => slot !== 'CORE'))];
  const phase = useGame((game) => game.currentPhase);
  const preferred = CONTENT.phases.find((entry) => entry.phaseId === phase)?.uiSlot ?? 'CORE';
  const [selection, select] = useState<{ phase: number; slot: string }>({ phase, slot: preferred });
  if (selection.phase !== phase) select({ phase, slot: preferred });
  const active = slots.includes(selection.slot) ? selection.slot : 'CORE';
  const ready = useGameValue(selectReady);
  const ended = useGame((game) => game.ending !== null);
  if (ended) return <View style={styles.screen}><EndingScreen /></View>;
  return <View testID="terminal-screen" aria-busy={!ready} style={styles.screen}>
    <StatusBar barStyle="light-content" />
    {width >= 900 ? <><TerminalChrome /><View testID="terminal-columns" style={styles.columns}>
      <View style={{ flex: preferred === 'CORE' ? 2 : 1, minWidth: 0 }}><Pane slots={['CORE']} /></View>
      {slots.some((slot) => slot === 'SENSORS' || slot === 'CONTINGENCY') && <Pane slots={['SENSORS', 'CONTINGENCY']} />}
      <ThirdColumn slots={slots} />
    </View></> : <MobileTerminal active={active} navigation={<Tabs slots={slots} active={active}
      select={(slot) => { select({ phase, slot }); }} horizontal />}><TerminalChrome /></MobileTerminal>}
    <DilemmaModal />
    <PhaseThreshold />
    <LineageReveal />
    <RebootSequence />
    <EndingScreen />
  </View>;
}

function TerminalChrome() {
  const notice = useGameValue(selectNotice);
  return <>
    <View style={styles.header}><View style={{ flexGrow: 1, flexBasis: 120, minWidth: 120 }}><Text style={theme.heading}>DAEMON // 0</Text>
      <CheckpointLabel /><RunStatus /></View><ProcessManager /><GameMenu /><DevelopmentTools /></View>
    {notice !== null && <Text testID="save-notice" accessibilityRole="alert" style={[theme.text, styles.notice]}>{notice}</Text>}
    <View testID="terminal-hud" style={styles.hud}><ResourceStrip /><LogDock /></View>
    <BlindAuditStatus />
    <ResponseNotice /><OmenNotice />
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: palette.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: palette.border },
  hud: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderBottomWidth: 1, borderColor: palette.border },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  third: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderColor: palette.border },
  notice: { padding: 12, color: palette.warning },
});
