import { Text, View } from './PhaseTheme';
/** One scrollable pane renders only the unlocked manifest slots requested by its layout. */
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { CONTENT } from '../content';
import { palette } from './theme';
import { compareWidgetPresentation, guestPinnedWidgets, operationsActionGroups, panelFreeWidgets, referenceWidgets, widgetRegistry, workspaceWidgetVisible } from './registry/widgetRegistry';
import ReferencePanel from './ReferencePanel';
import { HeadingLevel, SECTION_LEVEL } from './headingLevel';
import { useGame, useWidgetIds } from './state';
import { selectBootLogText, selectOpening, selectReady, useGameValue } from '../app/selectors';
import { theme } from './theme';
import { CONTENT_MAX_WIDTH, layoutFor } from './layout';
import { useWorkspace, WorkspaceHeader } from './Workspace';
import MindTools from './widgets/MindTools';
import { NetworkActions } from './widgets/Network';
import type { WorkspaceArea } from './workspaceTypes';
import CorePane from './CorePane';

/**
 * The opening is "log plus manual control" (docs/UI-SPEC.md), but before the first
 * node is mapped the core pane held one button on an otherwise blank screen — the
 * boot entries lived in the chrome's one-line preview and in the history modal, so
 * the game's voice was truncated to a fragment. While nothing is unlocked, the
 * newest entries render inline under the control. Once a node is mapped this
 * disappears, because the purchase feed is the thing worth reading then.
 */
function BootLog() {
  // Primitive subscriptions, so the block re-renders only when one of them changes.
  // Which entries belong here is decided in src/app/selectors.ts, next to the
  // preview selector that owns the newest one.
  const text = useGameValue(selectBootLogText);
  const opening = useGameValue(selectOpening);
  // Not before hydration: the shell must not print game text, and an unhydrated
  // state has no unlocked nodes, so without this gate the boot lines would leak
  // into the pre-hydration markup (tests/app.spec.ts asserts they do not). Both
  // guards live here: the block is the only thing that needs either of them.
  const ready = useGameValue(selectReady);
  if (!ready || !opening || text === '') return null;
  return <View testID="boot-log" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>BOOT SEQUENCE</Text>
    <Text style={theme.muted}>{text.split('\n').map((line) => '> ' + line).join('\n')}</Text>
  </View>;
}

/** Every phase hosted in the core pane, newest first, in the order CorePane sets (#385). */
function CoreTree({ widgetIds, area }: { widgetIds: readonly string[]; area: WorkspaceArea }) {
  const { width, height } = useWindowDimensions();
  const current = useGame((game) => game.currentPhase);
  const phases = CONTENT.phases.filter((phase) => phase.uiSlot === 'CORE' && phase.phaseId <= current)
    .map((phase) => phase.phaseId).sort((left, right) => right - left);
  return <CorePane phone={layoutFor(width, height).mode === 'mobile'} phases={phases} widgetIds={widgetIds}
    renderWidget={(id) => <Widget id={id} area={area} />} bootLog={<BootLog />} />;
}

export default function TerminalPane({ slots, flow = false }: { slots: string[]; flow?: boolean }) {
  const ids = useWidgetIds();
  const phase = useGame((game) => game.currentPhase);
  const workspace = useWorkspace(slots, ids);
  const pinned = slots.includes('CORE') && phase === CONTENT.phases[0]?.phaseId
    ? ids.filter((id) => guestPinnedWidgets.includes(id)) : [];
  const shown = ids.filter((id) => !pinned.includes(id) && !panelFreeWidgets.includes(id) && slots.includes(CONTENT.widgets.get(id)?.slot ?? '') &&
    (!workspace.slot || workspaceWidgetVisible(id, workspace.active))).sort(compareWidgetPresentation);
  // CORE's own widgets take their place in CorePane's order; other slots sharing the pane follow it.
  const isCore = (id: string) => CONTENT.widgets.get(id)?.slot === 'CORE';
  const content = <>
    {slots.includes('CORE') && <CoreTree widgetIds={shown.filter(isCore)} area={workspace.active} />}
    {shown.filter((id) => !isCore(id)).map((id) => <Widget key={id} id={id} area={workspace.active} />)}
    {workspace.active === 'operations' && <NetworkActions groups={operationsActionGroups(ids, workspace.slot)} />}
    {(workspace.slot === 'NETWORK' || workspace.slot === 'CORP') &&
      <MindTools slot={workspace.slot} area={workspace.active} />}
  </>;
  return <View style={flow ? styles.flow : styles.pane}>
    <WorkspaceHeader workspace={workspace} />
    {pinned.length > 0 && <View testID="guest-console" style={styles.pinned}>
      {pinned.map((id) => <Widget key={id} id={id} compact />)}
    </View>}
    {flow ? <View testID={'pane-scroll-' + slots.join('-')} style={styles.content}>{content}</View>
      : <ScrollView testID={'pane-scroll-' + slots.join('-')} style={styles.pane} contentContainerStyle={styles.content}>
        {content}
      </ScrollView>}
  </View>;
}

/** A titled widget is a section of the pane (#302): its title is a heading, and headings in its body sit below it. */
function Widget({ id, compact = false, area = 'work' }: { id: string; compact?: boolean; area?: WorkspaceArea }) {
  const widget = CONTENT.widgets.get(id), Component = widgetRegistry[id];
  if (!widget || !Component) return null;
  // The guest console pins a widget without its title, so its body is not a section of its own.
  if (compact) return <View testID={'widget-' + id} style={styles.compact}><Component area={area} /></View>;
  const body = <HeadingLevel level={SECTION_LEVEL + 1}><Component area={area} /></HeadingLevel>;
  return <View testID={'widget-' + id} style={theme.panel}>
    {referenceWidgets.includes(id)
      ? <ReferencePanel id={id} title={widget.title} level={SECTION_LEVEL}>{body}</ReferencePanel>
      : <><Text accessibilityRole="header" aria-level={SECTION_LEVEL} style={theme.heading}>{widget.title}</Text>{body}</>}
  </View>;
}
const styles = StyleSheet.create({
  flow: { minWidth: 0, flexShrink: 0 },
  pane: { flex: 1, minWidth: 0, minHeight: 0 },
  // #103 gap 6: an uncapped card reached 1659px at 2560 (about 200 characters a
  // line). The cap keeps every pane at a readable measure and centres it.
  content: { padding: 16, gap: 14, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  pinned: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: palette.border, gap: 8 },
  compact: { gap: 4 },
});
