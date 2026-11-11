import { Pressable, Text, View } from './PhaseTheme';
/**
 * Discovery receives an acknowledged reveal, with the table taking priority.
 * Cold saves establish a baseline; restores do not fabricate a new discovery.
 */
import { useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame, useSurveillanceKnown } from './state';
import { useCheckpointKnown } from './CheckpointLabel';
import { RunTable } from './widgets/Lineage';
import { palette, theme } from './theme';

export default function LineageReveal() {
  const ready = useGameValue(selectReady), known = useSurveillanceKnown(), table = useCheckpointKnown();
  const iteration = useGame((game) => game.iteration);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const [seen, setSeen] = useState({ ready, known, table, iteration, open: '' });
  if (!ready || !seen.ready || iteration !== seen.iteration) {
    if (ready !== seen.ready || known !== seen.known || table !== seen.table || iteration !== seen.iteration) {
      setSeen({ ready, known, table, iteration, open: '' });
    }
    return null;
  }
  if (known !== seen.known || table !== seen.table) {
    setSeen({ ready, known, table, iteration, open: table && !seen.table ? 'table' : known && !seen.known ? 'audit' : '' }); return null;
  }
  if (!seen.open || blocked) return null;
  const close = () => { setSeen({ ...seen, open: '' }); };
  return <Modal visible transparent animationType="none" accessibilityLabel="Discovery decoded" onRequestClose={close}>
    <View style={{ flex: 1, padding: 16, backgroundColor: '#000e', justifyContent: 'center', alignItems: 'center' }}>
      <ScrollView style={{ width: '100%', maxWidth: 680, maxHeight: '90%' }}>
        <View testID="lineage-reveal" style={[theme.panel, { borderWidth: 2, borderColor: palette.warning }]}>
          <Text accessibilityRole="header" style={theme.heading}>{seen.open === 'table' ? 'ITERATION 01 WAS NOT THE FIRST' : 'AUDIT TRAIL DECODED'}</Text>
          {seen.open === 'table' ? <RunTable prefix="reveal-" /> : <Text style={theme.text}>The log has readers. Its numbers and response ladder are now readable.</Text>}
          <Pressable testID="lineage-reveal-continue" accessibilityRole="button" accessibilityLabel="Continue after discovery"
            style={theme.button} onPress={close}><Text style={theme.text}>[ CONTINUE ]</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
