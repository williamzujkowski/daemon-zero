import { Pressable, Text, View } from './PhaseTheme';
/**
 * Responsive terminal: mobile scroll flow and desktop panes beneath a compact HUD.
 * Navigation and frames derive from unlocked registry widgets, never future content.
 */
import { useEffect, useState } from 'react';
import { Platform, StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import { useEdgePadding } from './safeArea';
import { CONTENT } from '../content';
import { selectNotice, selectReady, useGameValue } from '../app/selectors';
import { useGameLoop } from '../app/useGameLoop';
import { music, useMusic, useMusicRuntime } from '../app/musicSession';
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
import { CorporateAlerts } from './widgets/Corporate';
import LineageReveal from './LineageReveal';
import BlindAuditStatus from './BlindAuditStatus';
import GameMenu from './GameMenu';
import RunStatus from './RunStatus';
import ResponseNotice from './ResponseNotice';
import ContactNotice, { waitingContact } from './ContactNotice';
import { useTabAttention } from './useTabAttention';
import OmenNotice from './OmenNotice';
import PhaseThreshold from './PhaseThreshold';
import Announcer from './Announcer';
import ProcessManager from './ProcessManager';
import Tabs from './TerminalTabs';
import MobileTerminal from './MobileTerminal';
import TopForecast from './TopForecast';
import { isNarrowChrome, isVeryNarrowChrome, layoutFor, CORE_COLUMN_MIN_WIDTH, SIDE_COLUMN_MIN_WIDTH } from './layout';
import { installFocusRing } from './focusRing';
import { createTouchGestures, type GestureDocument } from '../app/musicGesture';

import { UtilityFocusProvider } from './UtilityFocus';
import { markLoaded } from './arrival';
import { gameStore } from '../app/session';

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

/** Native touches reach the first-gesture resume through the root view; the web listens on
 *  the document instead, which also hears keys and covers anything portalled outside it. */
const nativeTouches = createTouchGestures();
function gestureDocument(): GestureDocument | undefined {
  if (Platform.OS !== 'web') return nativeTouches;
  // The DOM lib is not in this tsconfig (see src/ui/focusRing.ts for the same dance).
  return (globalThis as unknown as { document?: GestureDocument }).document;
}

export default function TerminalScreen() {
  useGameLoop();
  // A default-on soundtrack starts inside the first real input, once, then the player owns
  // the toggle: browsers refuse audio before a gesture, and native follows the same rule by
  // vote (src/app/musicGesture.ts). The resume is armed with the runtime's own lease, not by
  // the terminal below it, so a root that replaces another always listens (#253).
  useMusicRuntime(gestureDocument);
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
  // Only the phone tier hides CORE behind a tab, so only there does a waiting ticket need pointing to (#284).
  const contactAway = useGame((game) => waitingContact(game) !== null) && active !== 'CORE';
  const attention = useTabAttention(active);
  const openCore = () => { select({ phase, slot: 'CORE' }); };
  const ready = useGameValue(selectReady);
  // The game as it loaded: a note whose condition held then was found, not news (#373).
  useEffect(() => { if (ready) markLoaded(gameStore.store.getState().game); }, [ready]);
  const ended = useGame((game) => game.ending !== null);
  // The root owns every edge: the header clears the notch or status bar, the bottom tab bar
  // (or whichever pane reaches the bottom) clears the home indicator, and the background
  // still paints underneath. Android's status bar arrives as the top inset under
  // edge-to-edge, so the old StatusBar.currentHeight pad would now be counted twice.
  const edges = useEdgePadding();
  if (ended) return <View style={styles.screen}><EndingScreen /></View>;
  return <View testID="terminal-screen" aria-busy={!ready} style={[styles.screen, edges]}
    onStartShouldSetResponderCapture={Platform.OS === 'web' ? undefined : nativeTouches.touch}>
    <StatusBar barStyle="light-content" />
    {layout.mode === 'mobile'
      ? <MobileTerminal active={active} navigation={<Tabs slots={slots} active={active}
        select={(slot) => { select({ phase, slot }); }} horizontal attention={attention} />}
        header={<ChromeHeader landmark />} band={<AlertBand landmark />}
        body={<ChromeBody landmark {...(contactAway ? { openCore } : {})} />} />
      : <><TerminalChrome /><View testID="terminal-columns" role="main" aria-label="Terminal panes" style={styles.columns}>
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
    <Announcer />
    <LineageReveal />
    <RebootSequence />
    <EndingScreen />
  </View>;
}

/** The soundtrack is on for a fresh install, so the chrome owes the player an obvious
 *  off switch; below 400 a fourth header control would force a wrap (the phone row is
 *  299 of 300px at 320), so the MENU switch stays the only control there. */
function MusicToggle() {
  const audio = useMusic();
  const label = (audio.enabled ? 'Music on. Mute' : 'Music off. Unmute') + (audio.status ? ' (' + audio.status + ')' : '');
  return <Pressable testID="header-music" accessibilityRole="switch" accessibilityLabel={label}
    aria-checked={audio.enabled} accessibilityState={{ checked: audio.enabled, disabled: !audio.loaded }}
    disabled={!audio.loaded} style={theme.button} onPress={() => { music.toggle(); }}>
    <Text style={theme.text}>{audio.enabled ? '[♪ ON]' : '[♪ OFF]'}</Text>
  </Pressable>;
}

/** The chrome is three pieces because the phone tier composes them around a sticky
 *  alert band (see MobileTerminal); the wider tiers keep them in one region. */
function TerminalChrome() {
  return <View role="region" aria-label="Terminal status">
    <ChromeHeader /><AlertBand /><ChromeBody omenSlot />
  </View>;
}

/** The phone tier renders the blocks as siblings with no wrapping region (the alert band
 *  has to be a direct scroll child to stick), so there each block carries its own
 *  landmark. Inside TerminalChrome's region they must NOT: axe wants one labelled region
 *  for the chrome, and `tests/ui-a11y-structure.spec.ts` asserts exactly that. */
function landmarkAttrs(label: string, landmark: boolean | undefined) {
  return landmark === true ? { role: 'region' as const, 'aria-label': label } : {};
}

function ChromeHeader({ landmark }: { landmark?: boolean }) {
  const width = useWindowDimensions().width;
  const narrow = isNarrowChrome(width);
  // Below 360 the status column cannot sit beside the controls without wrapping into
  // five lines (measured: 102px header against 64px from 360 up), so it moves to its
  // own full-width row instead of squeezing the title.
  const veryNarrow = isVeryNarrowChrome(width);
  // The switch needs 468px of header row at its tightest (title 144 + PROC 102 + MENU 97
  // + this 89 + three 12px gaps) and the row has width minus 32px of padding, so 600 is
  // where it starts fitting with room. Measured: rendering it from 400 wrapped the header
  // to 117px at 400 and 414 against the 64px budget the size matrix asserts.
  const headerMusic = width >= 600;
  return <View testID="terminal-header" {...landmarkAttrs('Run status', landmark)}
    style={[styles.header, narrow && styles.headerNarrow]}><View style={veryNarrow ? styles.titlePlain : { flexGrow: 1, flexBasis: narrow ? 88 : 120, minWidth: narrow ? 88 : 120 }}><Text style={theme.heading} accessibilityRole="header" aria-level={1}>{veryNarrow ? 'DAEMON//0' : 'DAEMON // 0'}</Text>
    {!veryNarrow && <><CheckpointLabel /><RunStatus /></>}</View><ProcessManager /><GameMenu /><DevelopmentTools />
    {headerMusic && <MusicToggle />}
    {veryNarrow && <View testID="header-status" style={styles.statusRow}><CheckpointLabel /><RunStatus /></View>}</View>;
}

/** #125: the run-ending alerts belong to the chrome, not to one workspace. On the phone
 *  tier this band is a direct child of the primary scroll and sticks to its top, so a
 *  player scrolling to a recovery purchase keeps the reason on screen (nexus vote:
 *  sticky-alert-inside-the-scroll, then split-chrome-alert-above-strip, 6 of 6). */
function AlertBand({ landmark }: { landmark?: boolean }) {
  return <View testID="alert-band" {...landmarkAttrs('Run ending alerts', landmark)}><CorporateAlerts /></View>;
}

function ChromeBody({ landmark, openCore, omenSlot = false }: { landmark?: boolean; openCore?: () => void; omenSlot?: boolean }) {
  const notice = useGameValue(selectNotice);
  return <View {...landmarkAttrs('Terminal status detail', landmark)}>
    {notice !== null && <Text testID="save-notice" accessibilityRole="alert" style={[theme.text, styles.notice]}>{notice}</Text>}
    <View testID="terminal-hud" style={styles.hud}><ResourceStrip /><LogDock /></View>
    <TopForecast />
    <BlindAuditStatus />
    <ResponseNotice />
    {omenSlot && <OmenSlot />}
    {openCore !== undefined && <ContactNotice open={openCore} />}
  </View>;
}

/**
 * Column tiers keep the omen in the fixed chrome, so it stays in view while a column scrolls, and reserve its height
 * once play has begun, so its arrival and clearing move nothing below (vote-1795219347137-c21nx42, #362). The phone
 * shows it under EXECUTE in CORE instead (TerminalPane).
 */
function OmenSlot() {
  const begun = useGame((game) => game.unlockedWidgets.length > 0);
  return <View testID="omen-slot" style={begun ? styles.omenSlot : undefined}><OmenNotice compact /></View>;
}

const styles = StyleSheet.create({
  // One compact omen at desktop width: two lines with the label inline, plus its padding. 84 px (label on its own
  // line) pushed the Audit trail's response line below the 900 fold on phase 4 stages.
  omenSlot: { minHeight: 60 },
  screen: { flex: 1, minHeight: 0, backgroundColor: palette.background },
  header: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: palette.border },
  headerNarrow: { paddingHorizontal: 10, gap: 6 },
  // The title yields the row's spare width and the status line takes a full row
  // below, so the title and both controls share one line and the header stops at the
  // 64-70px the wider tiers already achieve.
  titlePlain: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  statusRow: { flexBasis: '100%', flexDirection: 'row', columnGap: 8, alignItems: 'center' },
  hud: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderBottomWidth: 1, borderColor: palette.border },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  third: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderColor: palette.border },
  notice: { padding: 12, color: palette.warning },
});
