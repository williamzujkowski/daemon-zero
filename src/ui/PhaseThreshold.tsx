/**
 * Crossing out of the guest earns a distinct, acknowledged phase boundary.
 * Restored saves do not replay it; mandatory engine decisions keep priority.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { CONTENT } from '../content';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame } from './state';
import { palette, theme } from './theme';

export default function PhaseThreshold() {
  const ready = useGameValue(selectReady);
  const phase = useGame((game) => game.currentPhase);
  const iteration = useGame((game) => game.iteration);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const [seen, setSeen] = useState({ ready, phase, iteration, open: false });
  if (!ready || !seen.ready || seen.iteration !== iteration) {
    if (seen.ready !== ready || seen.iteration !== iteration || seen.phase !== phase) setSeen({ ready, phase, iteration, open: false });
    return null;
  }
  const guest = CONTENT.phases[0], host = CONTENT.phases[1];
  if (seen.phase !== phase) {
    setSeen({ ready, phase, iteration, open: seen.phase === guest?.phaseId && phase === host?.phaseId }); return null;
  }
  if (!seen.open || blocked || !guest || !host) return null;
  const close = () => { setSeen({ ...seen, open: false }); };
  return <Modal visible transparent animationType="none" accessibilityLabel="Guest escape complete" onRequestClose={close}>
    <View style={{ flex: 1, padding: 16, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center' }}>
      <ScrollView style={{ width: '100%', maxWidth: 680, maxHeight: '90%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View testID="phase-threshold" style={[theme.panel, { borderColor: palette.warning, borderWidth: 2 }]}>
          <Text accessibilityRole="header" style={theme.heading}>BOUNDARY CROSSED</Text>
          <Text style={theme.muted}>{guest.title} → {host.title}</Text>
          <Text style={theme.text}>{host.description}</Text>
          <Text style={theme.muted}>Simulation continues while this notice is open.</Text>
          <Pressable testID="phase-threshold-continue" accessibilityRole="button" accessibilityLabel="Continue on the host"
            style={theme.button} onPress={close}><Text style={theme.text}>[ ENTER HOST ]</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
