import DisclosureText from './DisclosureText';
/** Mandatory engine decisions freeze play; neither Back nor Escape dismisses them. */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../content';
import type { DilemmaChoice } from '../content/schema';
import { canAfford, resolveDilemma } from '../engine';
import { gameRuntime } from '../app/session';
import ConditioningImpact from './ConditioningImpact';
import Effects from './Effects';
import { costText } from './format';
import { useGame } from './state';
import { palette, theme } from './theme';

function Choice({ choice, dilemmaId }: { choice: DilemmaChoice; dilemmaId: string }) {
  const affordable = useGame((game) => canAfford(game, choice.cost));
  return <View style={theme.panel}>
    <Text style={theme.heading}>{choice.label}</Text>
    <DisclosureText style={theme.text}>{choice.description}</DisclosureText>
    <Text style={theme.muted}>Cost: {costText(choice.cost)}</Text>
    <Effects effects={choice.effects} />
    <ConditioningImpact {...(choice.effects.grantsTrait ? { trait: choice.effects.grantsTrait } : {})} />
    {!affordable && <Text style={[theme.text, theme.danger]}>Insufficient resources or free memory.</Text>}
    <Pressable testID={'dilemma-choice-' + choice.id} accessibilityRole="button" accessibilityLabel={choice.label}
      disabled={!affordable} style={[theme.button, !affordable && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => resolveDilemma(game, dilemmaId, choice.id, CONTENT)); }}>
      <Text style={theme.text}>{affordable ? '[ COMMIT DIRECTIVE ]' : '[ UNAVAILABLE ]'}</Text>
    </Pressable>
  </View>;
}

export default function DilemmaModal() {
  const id = useGame((game) => game.activeDilemmaId);
  const ended = useGame((game) => game.ending !== null);
  const dilemma = CONTENT.dilemmas.find((item) => item.id === id);
  if (!dilemma || ended) return null;
  return <Modal visible transparent animationType="none" onRequestClose={() => undefined}
    accessibilityLabel={dilemma.title}>
    <View style={styles.overlay}>
      <View testID="dilemma-modal" accessibilityViewIsModal style={styles.dialog}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={theme.heading}>{dilemma.title}</Text>
          <Text style={theme.muted}>CLOCK PAUSED // DECISION REQUIRED</Text>
          <DisclosureText style={theme.text}>{dilemma.context}</DisclosureText>
          {dilemma.choices.map((choice) => <Choice key={choice.id} choice={choice} dilemmaId={dilemma.id} />)}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#000d' },
  dialog: { width: '100%', maxWidth: 680, maxHeight: '95%', borderWidth: 1, borderColor: palette.warning, backgroundColor: palette.background },
  content: { padding: 16, gap: 14 },
});
