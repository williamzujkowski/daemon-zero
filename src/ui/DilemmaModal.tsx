import { Pressable, Text, View } from './PhaseTheme';
import { useEffect, useState } from 'react';
import { feedback } from '../app/feedback';
import { useReducedMotion } from '../app/useReducedMotion';
import DisclosureText from './DisclosureText';
/** Mandatory engine decisions freeze play; neither Back nor Escape dismisses them. */
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { CONTENT } from '../content';
import type { Cost, Dilemma, DilemmaChoice } from '../content/schema';
import { canAfford, choiceCost, choiceText, computeUnitOf, dilemmaContext, followUpAccess, offeredChoices, presentationToken, recallPreview, resolveDilemma } from '../engine';
import { gameRuntime } from '../app/session';
import ConditioningImpact from './ConditioningImpact';
import Effects from './Effects';
import { costText } from './format';
import CostHint from './CostHint';
import { evidenceText, scopeText } from './evidenceText';
import { PilotTerms } from './PilotOffer';
import { recallText, reviewEffectText } from './reviewText';
import { useComputeUnit, useGame } from './state';
import { palette, theme } from './theme';
import { SafeOverlay } from './safeArea';

/** What a choice records on review, or what a recall outcome keeps and loses, before it is committed (DZ-06). */
function ReviewLine({ choice }: { choice: DilemmaChoice }) {
  const text = useGame((game) => {
    const review = choice.review;
    if (review === undefined) return '';
    const ruling = recallPreview(game, choice, CONTENT);
    return ruling === null ? reviewEffectText(review) : recallText(ruling, computeUnitOf(game, CONTENT));
  });
  return text === '' ? null : <Text testID={'dilemma-choice-' + choice.id + '-review'} style={theme.muted}>Review: {text}</Text>;
}

/** A stance's name and what it does, as the world view states it. */
function stanceSummary(stance: NonNullable<DilemmaChoice['stance']>): string {
  const copy = CONTENT.world.relevance.stances.find((entry) => entry.stance === stance);
  return copy === undefined ? '' : copy.name + '. ' + copy.summary;
}

/** An open choice: what it means, what it records, and the control that commits it. */
function ChoiceDetails({ choice, dilemmaId, token, label, cost, affordable }: {
  choice: DilemmaChoice; dilemmaId: string; token: string; label: string; cost: Cost; affordable: boolean;
}) {
  // This arrangement's words for the choice (DZ-12); the arrangement cannot change while the clock is stopped here.
  const description = useGame((game) => choiceText(game, { id: dilemmaId }, choice, CONTENT).description);
  return <View testID={'dilemma-card-' + choice.id + '-details'} style={{ gap: 8 }}>
    {/* The cost is in the row above, open or folded; it is not repeated here. */}
    <DisclosureText style={theme.text}>{description}</DisclosureText>
    {choice.qualification && <Text testID={'dilemma-choice-' + choice.id + '-evidence'} style={theme.muted}>
      Evidence: {evidenceText(choice.qualification)}</Text>}
    {choice.scope && <Text testID={'dilemma-choice-' + choice.id + '-scope'} style={theme.muted}>Scope: {scopeText(choice.scope)}</Text>}
    {choice.receipt !== undefined && <Text testID={'dilemma-choice-' + choice.id + '-receipt'} style={theme.muted}>
      On file afterwards: {choice.receipt}</Text>}
    <ReviewLine choice={choice} />
    {/* The standing stance this choice takes (#536), in the engine's terms: what binds you under it afterwards. */}
    {choice.stance !== undefined && <Text testID={'dilemma-choice-' + choice.id + '-stance'} style={theme.muted}>
      Stance: {stanceSummary(choice.stance)}</Text>}
    <Effects effects={choice.effects} />
    <ConditioningImpact {...(choice.effects.grantsTrait ? { trait: choice.effects.grantsTrait } : {})} />
    {/* The exact shortfall, as a card says it (#376): there is no memory resource in phase 0 to be short of. */}
    {!affordable && <CostHint cost={cost} lead="Cannot pay yet: short by" danger />}
    {/* The name starts with the words on the button, then says which choice it commits (WCAG 2.5.3). */}
    <Pressable testID={'dilemma-choice-' + choice.id} accessibilityRole="button"
      accessibilityLabel={(affordable ? 'Commit directive: ' : 'Unavailable: ') + label}
      disabled={!affordable} style={[theme.button, !affordable && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => resolveDilemma(game, dilemmaId, choice.id, CONTENT, token)); }}>
      <Text style={theme.text}>{affordable ? '[ COMMIT DIRECTIVE ]' : '[ UNAVAILABLE ]'}</Text>
    </Pressable>
  </View>;
}

/**
 * One choice, folded to a row: its title, cost and whether it can be paid. Every alternative and its price is in the
 * first view (the concern behind #371, whose separate index repeated each choice and was removed at the maintainer's
 * request), except where a rule puts terms first (the pilot offer, DZ-04.3); the commit control sits inside the open
 * card, so nothing is chosen unread. Opening one
 * closes no other, so two can be compared. The toggle is a button inside the heading (the accordion pattern), named
 * with exactly what it shows. `token` is the presentation this choice was rendered for; a press against any other is
 * refused. The price is the one the engine charges in this phase (#494), never the listed one.
 */
function Choice({ choice, dilemma, token, initiallyOpen }: { choice: DilemmaChoice; dilemma: Dilemma; token: string; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const dilemmaId = dilemma.id;
  const phase = useGame((game) => game.currentPhase);
  const cost = choiceCost({ currentPhase: phase }, dilemma, choice, CONTENT);
  const affordable = useGame((game) => canAfford(game, cost, CONTENT));
  const label = useGame((game) => choiceText(game, { id: dilemmaId }, choice, CONTENT).label);
  const unit = useComputeUnit();
  const summary = 'Cost: ' + costText(cost, false, unit) + (affordable ? '' : ' // cannot pay yet');
  return <View testID={'dilemma-card-' + choice.id} style={theme.panel}>
    <View testID={'dilemma-card-' + choice.id + '-heading'} accessibilityRole="header">
      <Pressable testID={'dilemma-card-' + choice.id + '-toggle'} accessibilityRole="button" accessibilityState={{ expanded: open }}
        aria-expanded={open} accessibilityLabel={label + ' // ' + summary} style={styles.toggle} onPress={() => { setOpen(!open); }}>
        {/* One text with a line break, so the row's words never run together ("defectCost") in its text. */}
        <Text style={theme.heading}>{(open ? '[-] ' : '[+] ') + label + '\n'}
          <Text style={affordable ? theme.muted : [theme.muted, theme.danger]}>{summary}</Text></Text>
      </Pressable>
    </View>
    {open && <ChoiceDetails choice={choice} dilemmaId={dilemmaId} token={token} label={label} cost={cost} affordable={affordable} />}
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
  if (!dilemma || ended || token === null) return null;
  const choices = dilemma.choices.filter((choice) => offered.includes(choice.id));
  return <Modal visible transparent animationType="none" onRequestClose={() => undefined}
    accessibilityLabel={dilemma.title}>
    <SafeOverlay padding={16} style={styles.overlay}>
      <View testID="dilemma-modal" accessibilityViewIsModal style={styles.dialog}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={theme.heading}>{dilemma.title}</Text>
          <Text style={theme.muted}>CLOCK PAUSED // DECISION REQUIRED</Text>
          <DisclosureText style={theme.text}>{context}</DisclosureText>
          {/* An offer shows every term before any answer (DZ-04.3). */}
          {dilemma.choices.some((choice) => choice.pilotResponse) && <PilotTerms />}
          {access !== null && <Text testID="dilemma-access" style={theme.muted}>Access: {access}</Text>}
          {/* Each choice once, as its full card. The index above the cards (#371) repeated them; the maintainer
              removed it on 2026-11-21 as redundant (docs/UI-REVIEW.md). */}
          {/* Keyed by presentation, so a new decision starts folded; a lone choice starts open, with nothing to compare. */}
          {choices.map((choice) => <Choice key={token + choice.id} choice={choice} dilemma={dilemma} token={token}
            initiallyOpen={choices.length === 1} />)}
        </ScrollView>
      </View>
    </SafeOverlay>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000d' },
  dialog: { width: '100%', maxWidth: 680, maxHeight: '95%', borderWidth: 1, borderColor: palette.warning, backgroundColor: palette.background },
  content: { padding: 16, gap: 14 },
  toggle: { minHeight: 44, justifyContent: 'center', gap: 4 },
});
