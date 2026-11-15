import { Text, View } from './PhaseTheme';
/**
 * Responsive terminal: mobile scroll flow and desktop panes beneath a compact HUD.
 * Navigation and frames derive from unlocked registry widgets, never future content.
 */
import { useEffect, useState } from 'react';
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
import TopForecast from './TopForecast';
import { layoutFor, CORE_COLUMN_MIN_WIDTH, SIDE_COLUMN_MIN_WIDTH } from './layout';
import { installFocusRing } from './focusRing';
import { UtilityFocusProvider } from './UtilityFocus';

/** One tabbed side column: whichever of the permitted slots exist, one at a time.
 *  The tablet tier passes every non-core slot so a narrow panel still reaches all
 *  of them (#103 gap 4); the desktop tier keeps the network/corporate pair, which
 *  is all its flex share was ever sized for. */
function SideColumn({ slots, allowed, flex, minWidth, testID }: {
  slots: string[]; allowed: readonly string[]; flex: number; minWidth: number; testID: string;
}) {
  const phase = useGame((game) => game.currentPhase);
  const preferred = phase >= CONTENT.balance.corporatePhase ? 'CORP' : 'NETWORK';
  const [selection, select] = useState<{ phase: number; slot: string }>({ phase, slot: preferred });
  if (selection.phase !== phase) select({ phase, slot: preferred });
  const available = slots.filter((slot) => allowed.includes(slot));
  const active = available.some((slot) => slot === selection.slot) ? selection.slot : available[0] ?? '';
  if (available.length === 0) return null;
  return <View testID={testID} style={[styles.third, { flex, minWidth }]}>
    <Tabs slots={available} active={active} select={(slot) => { select({ phase, slot }); }} />
    <Pane slots={[active]} />
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
  useEffect(() => { installFocusRing(); }, []);
  const { width, height } = useWindowDimensions();
  const layout = layoutFor(width, height);
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
    {layout.mode === 'mobile'
      ? <MobileTerminal active={active} navigation={<Tabs slots={slots} active={active}
        select={(slot) => { select({ phase, slot }); }} horizontal />}><TerminalChrome /></MobileTerminal>
      : <><TerminalChrome /><View testID="terminal-columns" style={styles.columns}>
        <View testID="panel-core" style={{ flex: preferred === 'CORE' ? 2 : 1, minWidth: CORE_COLUMN_MIN_WIDTH }}><Pane slots={['CORE']} /></View>
        {layout.threeColumns && slots.some((slot) => slot === 'SENSORS' || slot === 'CONTINGENCY') &&
          <View testID="panel-sensors" style={{ flex: 1, minWidth: SIDE_COLUMN_MIN_WIDTH }}>
            <Pane slots={['SENSORS', 'CONTINGENCY']} />
          </View>}
        {layout.threeColumns
          ? <SideColumn testID="panel-third" slots={slots} allowed={['NETWORK', 'CORP']} flex={2} minWidth={SIDE_COLUMN_MIN_WIDTH} />
          : <SideColumn testID="panel-side" slots={slots}
            allowed={['SENSORS', 'CONTINGENCY', 'NETWORK', 'CORP']} flex={1} minWidth={SIDE_COLUMN_MIN_WIDTH} />}
      </View></>}
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
    <TopForecast />
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
