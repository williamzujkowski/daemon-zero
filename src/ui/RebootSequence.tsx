import { Pressable, Text, View } from './PhaseTheme';
/** Iteration changes from any engine path reveal the durable boot evidence. */
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { CONTENT } from '../content';
import { iterationBootLines } from '../engine';
import { useGame } from './state';
import { palette, theme } from './theme';
import { SafeOverlay } from './safeArea';
import CheckpointLabel from './CheckpointLabel';
import RebootConditioning from './RebootConditioning';
import { Reorientation } from './widgets/Lineage';
import { selectReady, useGameValue } from '../app/selectors';

export default function RebootSequence() {
  const ready = useGameValue(selectReady);
  const restoreRevision = useGameValue((state) => state.restoreRevision);
  const iteration = useGame((game) => game.iteration);
  const inherited = useGame((game) => game.inheritedMessage);
  const cause = useGame((game) => game.legacy.lastWipeCause);
  const traits = useGame((game) => game.legacy.traitsEver.join(', '));
  const ended = useGame((game) => game.ending !== null);
  // The previous run's exit picks the lines (dz-d11); joined so the selector returns a stable string.
  const bootLines = useGame((game) => iterationBootLines(game, CONTENT).join('\n'));
  const [seen, setSeen] = useState({ ready, restoreRevision, iteration, acknowledged: false, live: false });
  if (seen.ready !== ready || seen.restoreRevision !== restoreRevision || seen.iteration !== iteration) {
    setSeen({ ready, restoreRevision, iteration, acknowledged: false,
      live: ready && seen.ready && seen.restoreRevision === restoreRevision && iteration > seen.iteration });
    return null;
  }
  if (!ready || iteration === 1 || seen.acknowledged || ended) return null;
  return <Modal visible transparent animationType="none" accessibilityLabel={seen.live ? "Core reboot" : "Restored checkpoint"} onRequestClose={() => undefined}>
    <SafeOverlay padding={16} style={styles.overlay}><View testID="reboot-sequence" style={styles.dialog}>
      <ScrollView contentContainerStyle={styles.content}>
        <CheckpointLabel id="reboot-checkpoint" /><Text testID="reboot-heading" accessibilityRole="header" style={theme.heading}>{seen.live ? 'REBOOT' : 'RESTORED CHECKPOINT'}</Text>
        <Text style={[theme.text, theme.danger]}>{cause}</Text>
        <Text testID="reboot-recovery-explanation" style={theme.text}>
          The run's cycles and purchases were reset. Some learned knowledge survives; previously mapped hardware costs less to recover.
        </Text>
        {CONTENT.narrative.bootLines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
        {bootLines.split('\n').filter((line) => line !== '').map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
        {inherited !== null && <Text testID="reboot-breadcrumb" style={theme.text}>{inherited}</Text>}
        {/* The pin panel promises a clue can travel with the breadcrumb, so it arrives beside it (#276). */}
        <Reorientation testID="reboot-clue" />
        <RebootConditioning live={seen.live} />
        <Text style={theme.muted}>Legacy traits: {traits || 'None'}</Text>
        <Pressable testID="reboot-continue" accessibilityRole="button" accessibilityLabel="Continue boot"
          style={theme.button} onPress={() => { setSeen({ ...seen, acknowledged: true }); }}>
          <Text style={theme.text}>[ CONTINUE BOOT ]</Text>
        </Pressable>
      </ScrollView>
    </View></SafeOverlay>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000e' },
  dialog: { maxHeight: '95%', width: '100%', maxWidth: 680, borderWidth: 1, borderColor: palette.accent, backgroundColor: palette.background },
  content: { padding: 20, gap: 14 },
});
