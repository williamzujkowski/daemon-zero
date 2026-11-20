import { Pressable, Text, View } from './PhaseTheme';
import { useEffect, useRef, type ComponentRef } from 'react';
import { feedback } from '../app/feedback';
import { useReducedMotion } from '../app/useReducedMotion';
import DisclosureText from './DisclosureText';
/** Mandatory engine decisions freeze play; neither Back nor Escape dismisses them. */
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { CONTENT } from '../content';
import type { DilemmaChoice } from '../content/schema';
import { canAfford, choiceText, dilemmaContext, followUpAccess, offeredChoices, presentationToken, recallPreview, resolveDilemma } from '../engine';
import { gameRuntime } from '../app/session';
import ConditioningImpact from './ConditioningImpact';
import Effects from './Effects';
import { costText } from './format';
import { evidenceText, scopeText } from './evidenceText';
import { PilotTerms } from './PilotOffer';
import { recallText, reviewEffectText } from './reviewText';
import { useGame } from './state';
import { palette, theme } from './theme';
import { SafeOverlay } from './safeArea';

/** What a choice records on review, or what a recall outcome keeps and loses, before it is committed (DZ-06). */
function ReviewLine({ choice }: { choice: DilemmaChoice }) {
  const text = useGame((game) => {
    const review = choice.review;
    if (review === undefined) return '';
    const ruling = recallPreview(game, choice, CONTENT);
    return ruling === null ? reviewEffectText(review) : recallText(ruling);
  });
  return text === '' ? null : <Text testID={'dilemma-choice-' + choice.id + '-review'} style={theme.muted}>Review: {text}</Text>;
}

/**
 * One row per offered choice, in authored order, under the context: its title, cost and whether it can be paid.
 * On a phone the cards run far below the fold (the first live commit sat at y=1249 of 844), so the player sees
 * that alternatives exist and what they cost before committing to any (vote-1795206922704-4ljmpd2, #371).
 */
function ChoiceIndexRow({ choice, dilemmaId, jump }: { choice: DilemmaChoice; dilemmaId: string; jump: () => void }) {
  const affordable = useGame((game) => canAfford(game, choice.cost));
  const label = useGame((game) => choiceText(game, { id: dilemmaId }, choice, CONTENT).label);
  const shown = label + ' // ' + costText(choice.cost) + (affordable ? '' : ' // cannot pay yet');
  return <Pressable testID={'dilemma-index-' + choice.id} accessibilityRole="button" accessibilityLabel={shown + ', go to this choice'}
    style={styles.indexRow} onPress={jump}>
    <Text style={affordable ? theme.text : theme.muted}>{'> '}{shown}</Text>
  </Pressable>;
}

/** `token` is the presentation this choice was rendered for; a press against any other is refused. */
function Choice({ choice, dilemmaId, token, place }: { choice: DilemmaChoice; dilemmaId: string; token: string; place: (y: number) => void }) {
  const affordable = useGame((game) => canAfford(game, choice.cost));
  // This arrangement's words for the choice (DZ-12); the arrangement cannot change while the clock is stopped here.
  const label = useGame((game) => choiceText(game, { id: dilemmaId }, choice, CONTENT).label);
  const description = useGame((game) => choiceText(game, { id: dilemmaId }, choice, CONTENT).description);
  return <View testID={'dilemma-card-' + choice.id} style={theme.panel} onLayout={(event) => { place(event.nativeEvent.layout.y); }}>
    <Text style={theme.heading}>{label}</Text>
    <DisclosureText style={theme.text}>{description}</DisclosureText>
    <Text style={theme.muted}>Cost: {costText(choice.cost)}</Text>
    {choice.qualification && <Text testID={'dilemma-choice-' + choice.id + '-evidence'} style={theme.muted}>
      Evidence: {evidenceText(choice.qualification)}</Text>}
    {choice.scope && <Text testID={'dilemma-choice-' + choice.id + '-scope'} style={theme.muted}>Scope: {scopeText(choice.scope)}</Text>}
    {choice.receipt !== undefined && <Text testID={'dilemma-choice-' + choice.id + '-receipt'} style={theme.muted}>
      On file afterwards: {choice.receipt}</Text>}
    <ReviewLine choice={choice} />
    <Effects effects={choice.effects} />
    <ConditioningImpact {...(choice.effects.grantsTrait ? { trait: choice.effects.grantsTrait } : {})} />
    {!affordable && <Text style={[theme.text, theme.danger]}>Insufficient resources or free memory.</Text>}
    {/* The name starts with the words on the button, then says which choice it commits (WCAG 2.5.3). */}
    <Pressable testID={'dilemma-choice-' + choice.id} accessibilityRole="button"
      accessibilityLabel={(affordable ? 'Commit directive: ' : 'Unavailable: ') + label}
      disabled={!affordable} style={[theme.button, !affordable && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => resolveDilemma(game, dilemmaId, choice.id, CONTENT, token)); }}>
      <Text style={theme.text}>{affordable ? '[ COMMIT DIRECTIVE ]' : '[ UNAVAILABLE ]'}</Text>
    </Pressable>
  </View>;
}

export default function DilemmaModal() {
  const reduced = useReducedMotion();
  const id = useGame((game) => game.activeDilemmaId);
  const token = useGame(presentationToken);
  const ended = useGame((game) => game.ending !== null);
  useEffect(() => { if (id && !ended) void feedback('interrupt', reduced); }, [id, ended, reduced]);
  const dilemma = CONTENT.dilemmas.find((item) => item.id === id);
  // Variants read only world history, which cannot change while the clock is stopped here.
  const context = useGame((game) => dilemma ? dilemmaContext(game, dilemma, CONTENT) : '');
  // A primitive selector over the same history: choices a world without their subject cannot offer stay hidden.
  const offered = useGame((game) => dilemma ? offeredChoices(game, dilemma, CONTENT).map((choice) => choice.id).join(' ') : '').split(' ');
  // How this instance reaches a follow-up's record, and who authorized that route, before any commit (NH-06).
  const access = useGame((game) => dilemma ? followUpAccess(game, dilemma, CONTENT)?.statement ?? null : null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const cardTop = useRef<Record<string, number>>({});
  if (!dilemma || ended || token === null) return null;
  const choices = dilemma.choices.filter((choice) => offered.includes(choice.id));
  return <Modal visible transparent animationType="none" onRequestClose={() => undefined}
    accessibilityLabel={dilemma.title}>
    <SafeOverlay padding={16} style={styles.overlay}>
      <View testID="dilemma-modal" accessibilityViewIsModal style={styles.dialog}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={theme.heading}>{dilemma.title}</Text>
          <Text style={theme.muted}>CLOCK PAUSED // DECISION REQUIRED</Text>
          <DisclosureText style={theme.text}>{context}</DisclosureText>
          {choices.length > 1 && <View testID="dilemma-index" style={styles.index}>
            <Text style={theme.muted}>{choices.length} CHOICES</Text>
            {choices.map((choice) => <ChoiceIndexRow key={choice.id} choice={choice} dilemmaId={dilemma.id}
              jump={() => { scroll.current?.scrollTo({ y: cardTop.current[choice.id] ?? 0, animated: false }); }} />)}
          </View>}
          {/* An offer shows every term before any answer (DZ-04.3). */}
          {dilemma.choices.some((choice) => choice.pilotResponse) && <PilotTerms />}
          {access !== null && <Text testID="dilemma-access" style={theme.muted}>Access: {access}</Text>}
          {choices.map((choice) => <Choice key={choice.id} choice={choice} dilemmaId={dilemma.id} token={token}
            place={(y) => { cardTop.current[choice.id] = y; }} />)}
        </ScrollView>
      </View>
    </SafeOverlay>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000d' },
  dialog: { width: '100%', maxWidth: 680, maxHeight: '95%', borderWidth: 1, borderColor: palette.warning, backgroundColor: palette.background },
  content: { padding: 16, gap: 14 },
  index: { gap: 4 },
  indexRow: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, paddingVertical: 6 },
});
