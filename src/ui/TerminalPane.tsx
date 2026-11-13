import { Text, View } from './PhaseTheme';
/** One scrollable pane renders only the unlocked manifest slots requested by its layout. */
import { ScrollView, StyleSheet } from 'react-native';
import { CONTENT } from '../content';
import ManualCycle from './ManualCycle';
import NodeList from './NodeList';
import { Conditioning } from './widgets/Lineage';
import UpgradeFeed from './UpgradeFeed';
import { guestPinnedWidgets, referenceWidgets, stripOnlyWidgets, widgetRegistry, workspaceWidgetVisible } from './registry/widgetRegistry';
import ReferencePanel from './ReferencePanel';
import { useGame, useWidgetIds } from './state';
import { theme } from './theme';
import { useWorkspace, WorkspaceHeader } from './Workspace';
import MindTools from './widgets/MindTools';
import type { WorkspaceArea } from './workspaceTypes';

/** Hardware of every phase hosted in the core pane, newest first, available before owned. */
function CoreTree() {
  const current = useGame((game) => game.currentPhase);
  const iteration = useGame((game) => game.iteration);
  const phases = CONTENT.phases.filter((phase) => phase.uiSlot === 'CORE' && phase.phaseId <= current)
    .map((phase) => phase.phaseId).sort((left, right) => right - left);
  return <>
    <ManualCycle />
    <Conditioning key={iteration} />
    {phases.map((phase) => <NodeList key={'open-' + String(phase)} phase={phase} />)}
    {phases.map((phase) => <UpgradeFeed key={'rep-' + String(phase)} phase={phase} />)}
  </>;
}

export default function TerminalPane({ slots, flow = false }: { slots: string[]; flow?: boolean }) {
  const ids = useWidgetIds();
  const phase = useGame((game) => game.currentPhase);
  const workspace = useWorkspace(slots, ids);
  const pinned = slots.includes('CORE') && phase === CONTENT.phases[0]?.phaseId
    ? ids.filter((id) => guestPinnedWidgets.includes(id)) : [];
  const content = <>
    {slots.includes('CORE') && <CoreTree />}
    {ids.filter((id) => !pinned.includes(id) && !stripOnlyWidgets.includes(id) && slots.includes(CONTENT.widgets.get(id)?.slot ?? '') &&
      (!workspace.slot || workspaceWidgetVisible(id, workspace.active)))
      .map((id) => <Widget key={id} id={id} area={workspace.active} />)}
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

function Widget({ id, compact = false, area = 'work' }: { id: string; compact?: boolean; area?: WorkspaceArea }) {
  const widget = CONTENT.widgets.get(id), Component = widgetRegistry[id];
  return widget && Component ? <View testID={'widget-' + id} style={compact ? styles.compact : theme.panel}>
    {!compact && referenceWidgets.includes(id)
      ? <ReferencePanel id={id} title={widget.title}><Component area={area} /></ReferencePanel>
      : <>{!compact && <Text style={theme.heading}>{widget.title}</Text>}<Component area={area} /></>}
  </View> : null;
}
const styles = StyleSheet.create({
  flow: { minWidth: 0, flexShrink: 0 },
  pane: { flex: 1, minWidth: 0, minHeight: 0 }, content: { padding: 16, gap: 14 },
  pinned: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#315c3b', gap: 8 },
  compact: { gap: 4 },
});
