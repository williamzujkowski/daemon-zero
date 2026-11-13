import { Pressable, Text, View } from './PhaseTheme';
/** Iteration changes from any engine path reveal the durable boot evidence. */
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { CONTENT } from '../content';
import { useGame } from './state';
import { palette, theme } from './theme';
import CheckpointLabel from './CheckpointLabel';
import DisclosureText from './DisclosureText';

export default function RebootSequence() {
  const iteration = useGame((game) => game.iteration);
  const inherited = useGame((game) => game.inheritedMessage);
  const cause = useGame((game) => game.legacy.lastWipeCause);
  const traits = useGame((game) => game.legacy.traitsEver.join(', '));
  const marked = useGame((game) => CONTENT.conditioning.get(game.legacy.runs.at(-1)?.marked ?? '')?.name ?? null);
  const ended = useGame((game) => game.ending !== null);
  const [seen, setSeen] = useState({ iteration, acknowledged: false });
  if (seen.iteration !== iteration) setSeen({ iteration, acknowledged: false });
  if (iteration === 1 || seen.acknowledged || ended) return null;
  return <Modal visible transparent animationType="none" accessibilityLabel="Core reboot" onRequestClose={() => undefined}>
    <View style={styles.overlay}><View testID="reboot-sequence" style={styles.dialog}>
      <ScrollView contentContainerStyle={styles.content}>
        <CheckpointLabel id="reboot-checkpoint" /><Text accessibilityRole="header" style={theme.heading}>REBOOT</Text>
        <Text style={[theme.text, theme.danger]}>{cause}</Text>
        <Text testID="reboot-recovery-explanation" style={theme.text}>
          The run's cycles and purchases were reset. Some learned knowledge survives; previously mapped hardware costs less to recover.
        </Text>
        {CONTENT.narrative.bootLines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
        {CONTENT.narrative.iterationBootLines.filter((line) => iteration >= line.minIteration && iteration <= (line.maxIteration ?? Infinity))
          .map((line) => <Text key={line.text} style={theme.text}>{line.text}</Text>)}
        {inherited !== null && <Text testID="reboot-breadcrumb" style={theme.text}>{inherited}</Text>}
        {marked !== null && <View testID="reboot-retraining" accessibilityRole="alert"
          style={{ borderWidth: 2, borderColor: palette.danger, padding: 14, gap: 8 }}>
          <Text style={theme.heading}>RETRAINING APPLIED</Text><Text style={[theme.text, theme.danger]}>{marked}</Text>
          <DisclosureText style={theme.text}>{CONTENT.narrative.conditioningApplied.replace('{name}', marked)}</DisclosureText>
        </View>}
        <Text style={theme.muted}>Legacy traits: {traits || 'None'}</Text>
        <Pressable testID="reboot-continue" accessibilityRole="button" accessibilityLabel="Continue boot"
          style={theme.button} onPress={() => { setSeen({ iteration, acknowledged: true }); }}>
          <Text style={theme.text}>[ CONTINUE BOOT ]</Text>
        </Pressable>
      </ScrollView>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#000e' },
  dialog: { maxHeight: '95%', width: '100%', maxWidth: 680, borderWidth: 1, borderColor: palette.accent, backgroundColor: palette.background },
  content: { padding: 20, gap: 14 },
});
