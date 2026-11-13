/** Maintenance is available from every pane without competing with purchases.
 * Closing the panel only unmounts controls; engine processes keep running.
 */
import { useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { CONTENT } from '../content';
import DaemonProcesses from './DaemonProcesses';
import { Pressable, Text, View } from './PhaseTheme';
import { needsProcessControl } from './purchaseVisibility';
import { useGame } from './state';
import { theme } from './theme';

export default function ProcessManager() {
  const count = useGame((game) => [...CONTENT.nodes.values()].filter((node) => needsProcessControl(game, node)).length);
  const suspended = useGame((game) => game.disabledNodes.length);
  const blocked = useGame((game) => game.activeDilemmaId !== null);
  const [open, setOpen] = useState(false);
  if (count === 0) {
    if (open) setOpen(false);
    return null;
  }
  return <>
    <Pressable testID="processes-open" accessibilityRole="button"
      accessibilityLabel={'Manage ' + String(count) + ' daemon processes, ' + String(suspended) + ' suspended'}
      accessibilityState={{ expanded: open }} aria-expanded={open} disabled={blocked}
      style={theme.button}
      onPress={() => { setOpen(true); }}>
      <Text style={theme.muted}>[ PROC {count} ]</Text>
    </Pressable>
    {open && !blocked && <Modal visible transparent animationType="none" accessibilityLabel="Daemon processes"
      onRequestClose={() => { setOpen(false); }}>
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000e' }}>
        <View testID="processes-dialog" style={[theme.panel, { width: '100%', maxWidth: 760, maxHeight: '90%' }]}>
          <Text accessibilityRole="header" style={theme.heading}>DAEMON PROCESSES</Text>
          <Text style={theme.muted}>{count - suspended} running // {suspended} suspended</Text>
          <Text style={theme.muted}>Running processes keep their effects when this panel is closed. Simulation continues.</Text>
          <ScrollView contentContainerStyle={{ gap: 14 }}>
            {CONTENT.phases.map((phase) => <DaemonProcesses key={phase.phaseId} phase={phase.phaseId} />)}
          </ScrollView>
          <Pressable testID="processes-close" accessibilityRole="button" accessibilityLabel="Close daemon processes"
            style={theme.button} onPress={() => { setOpen(false); }}><Text style={theme.text}>[ CLOSE ]</Text></Pressable>
        </View>
      </View>
    </Modal>}
  </>;
}
