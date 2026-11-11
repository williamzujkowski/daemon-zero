/** Iteration changes from any engine path reveal the durable boot evidence. */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../content';
import { useGame } from './state';
import { palette, theme } from './theme';

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
        <Text accessibilityRole="header" style={theme.heading}>ITERATION {iteration} // REBOOT</Text>
        <Text style={[theme.text, theme.danger]}>{cause}</Text>
        {CONTENT.narrative.bootLines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
        {inherited !== null && <Text testID="reboot-breadcrumb" style={theme.text}>{inherited}</Text>}
        {marked !== null && <Text testID="reboot-retraining" style={[theme.text, theme.danger]}>
          Retraining applied before redeployment: {marked}</Text>}
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
