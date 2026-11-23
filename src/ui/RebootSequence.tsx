import { Pressable, Text, View } from './PhaseTheme';
/** Iteration changes from any engine path reveal the durable boot evidence. */
import { useEffect, useState } from 'react';
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
import { focusPrimaryAction } from './primaryFocus';
import { TRAIT_RULE } from './traitText';
import { carryOverText } from './carryText';
import { BecomingReadout } from './Becoming';

export default function RebootSequence() {
  const ready = useGameValue(selectReady);
  const restoreRevision = useGameValue((state) => state.restoreRevision);
  const iteration = useGame((game) => game.iteration);
  const inherited = useGame((game) => game.inheritedMessage);
  const cause = useGame((game) => game.legacy.lastWipeCause);
  const traits = useGame((game) => game.legacy.traitsEver.join(', '));
  // The run that ended into this iteration recorded what it carried (#377); a string keeps the selector stable.
  const carried = useGame((game) => carryOverText(game.legacy.runs.at(-1)?.kept ?? null, game.legacy.knownNodes.length));
  const ended = useGame((game) => game.ending !== null);
  // The previous run's exit picks the lines (dz-d11); joined so the selector returns a stable string.
  const bootLines = useGame((game) => iterationBootLines(game, CONTENT).join('\n'));
  const [seen, setSeen] = useState({ ready, restoreRevision, iteration, acknowledged: false, live: false });
  // Continue closes the dialog; focus goes to the first action instead of falling to the page body (#364).
  // An effect, not a timer, so it also runs on the paused clock the atlas captures with.
  useEffect(() => { if (seen.acknowledged) focusPrimaryAction(); }, [seen.acknowledged]);
  if (seen.ready !== ready || seen.restoreRevision !== restoreRevision || seen.iteration !== iteration) {
    setSeen({ ready, restoreRevision, iteration, acknowledged: false,
      live: ready && seen.ready && seen.restoreRevision === restoreRevision && iteration > seen.iteration });
    return null;
  }
  if (!ready || iteration === 1 || seen.acknowledged || ended) return null;
  return <Modal visible transparent animationType="none" accessibilityLabel={seen.live ? "Core reboot" : "Restored checkpoint"} onRequestClose={() => undefined}>
    <SafeOverlay padding={16} style={styles.overlay}><View testID="reboot-sequence" style={styles.dialog}>
      {/* With Continue in the footer the body holds no control, so it takes focus itself and keyboard users
          can scroll it (axe scrollable-region-focusable). */}
      <ScrollView testID="reboot-body" focusable accessibilityLabel="Reboot details" style={styles.body} contentContainerStyle={styles.content}>
        <CheckpointLabel id="reboot-checkpoint" /><Text testID="reboot-heading" accessibilityRole="header" style={theme.heading}>{seen.live ? 'REBOOT' : 'RESTORED CHECKPOINT'}</Text>
        <Text style={[theme.text, theme.danger]}>{cause}</Text>
        <Text testID="reboot-recovery-explanation" style={theme.text}>{carried}</Text>
        {CONTENT.narrative.bootLines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
        {bootLines.split('\n').filter((line) => line !== '').map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
        {inherited !== null && <Text testID="reboot-breadcrumb" style={theme.text}>{inherited}</Text>}
        {/* The pin panel promises a clue can travel with the breadcrumb, so it arrives beside it (#276). */}
        <Reorientation testID="reboot-clue" />
        <RebootConditioning live={seen.live} />
        {/* Who the record says this lineage is becoming (#535), read from the same evidence the ending counts. */}
        <BecomingReadout testID="reboot-becoming" title="WHO YOU ARE BECOMING" />
        <Text testID="reboot-traits" style={theme.muted}>Legacy traits: {traits || 'none yet'}. {TRAIT_RULE}</Text>
      </ScrollView>
      {/* The only way out stays at the dialog's foot while the body scrolls: inside the body it sat 21%
          visible at the 844 phone fold with no cue (#371). */}
      <View style={styles.footer}>
        <Pressable testID="reboot-continue" accessibilityRole="button" accessibilityLabel="Continue boot"
          style={theme.button} onPress={() => { setSeen({ ...seen, acknowledged: true }); }}>
          <Text style={theme.text}>[ CONTINUE BOOT ]</Text>
        </Pressable>
      </View>
    </View></SafeOverlay>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000e' },
  dialog: { maxHeight: '95%', width: '100%', maxWidth: 680, borderWidth: 1, borderColor: palette.accent, backgroundColor: palette.background },
  body: { flexShrink: 1 },
  content: { padding: 20, gap: 14 },
  footer: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderColor: palette.border },
});
