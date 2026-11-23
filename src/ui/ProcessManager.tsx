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
import { SafeOverlay } from './safeArea';
import { useRouteRequests } from './routeRequest';
import { useShallow } from 'zustand/react/shallow';
import { storageLine } from './networkText';

/** Storage held against capacity (#484), once anything holds or grants storage: suspending a process that stores data frees it. */
function StorageHeld() {
  const line = useGame(useShallow((game) => game.storageUsed > 0 || game.storageCap > CONTENT.balance.baseStorageCap ? storageLine(game) : null));
  if (line === null) return null;
  return <Text testID="processes-storage" accessibilityLabel={line.spoken} style={theme.muted}>{line.shown}</Text>;
}

export default function ProcessManager() {
  const count = useGame((game) => [...CONTENT.nodes.values()].filter((node) => needsProcessControl(game, node)).length);
  const suspended = useGame((game) => game.disabledNodes.length);
  const blocked = useGame((game) => game.activeDilemmaId !== null);
  const [open, setOpen] = useState(false);
  // #369: a remedy that names PROC opens it.
  useRouteRequests((target) => { if (target.kind === 'proc' && count > 0 && !blocked) setOpen(true); });
  if (count === 0) {
    if (open) setOpen(false);
    return null;
  }
  return <>
    <Pressable testID="processes-open" accessibilityRole="button"
      accessibilityLabel={'[ PROC ' + String(count) + ' ] Manage ' + String(count) + ' daemon processes, ' + String(suspended) + ' suspended'}
      accessibilityState={{ expanded: open }} aria-expanded={open} disabled={blocked}
      style={theme.button}
      onPress={() => { setOpen(true); }}>
      <Text style={theme.muted}>[ PROC {count} ]</Text>
    </Pressable>
    {open && !blocked && <Modal visible transparent animationType="none" accessibilityLabel="Daemon processes"
      onRequestClose={() => { setOpen(false); }}>
      <SafeOverlay padding={16} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000e' }}>
        <View testID="processes-dialog" style={[theme.panel, { width: '100%', maxWidth: 760, maxHeight: '90%' }]}>
          <Text accessibilityRole="header" style={theme.heading}>DAEMON PROCESSES</Text>
          <Text style={theme.muted}>{count - suspended} running // {suspended} suspended</Text>
          <Text style={theme.muted}>Running processes keep their effects when this panel is closed. Simulation continues.</Text>
          <StorageHeld />
          <ScrollView contentContainerStyle={{ gap: 14 }}>
            {CONTENT.phases.map((phase) => <DaemonProcesses key={phase.phaseId} phase={phase.phaseId} />)}
          </ScrollView>
          <Pressable testID="processes-close" accessibilityRole="button" accessibilityLabel="Close daemon processes"
            style={theme.button} onPress={() => { setOpen(false); }}><Text style={theme.text}>[ CLOSE ]</Text></Pressable>
        </View>
      </SafeOverlay>
    </Modal>}
  </>;
}
