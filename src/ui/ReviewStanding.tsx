/**
 * The job surface's review record (DZ-06, SPEC stories 14-16): the current standing, each violation on
 * this instance's record in the review's words, the way back, and an announced recall review with every
 * outcome previewed before it arrives. Read-only: nothing here calls an action. It renders nothing for
 * an instance with nothing on review, so production and a clean pilot see no new panel.
 */
import { CONTENT } from '../content';
import { loanCeiling, reviewView, type ReviewView } from '../engine';
import { Text, View } from './PhaseTheme';
import { CONDUCT_TEXT, heldText, recallText, STANDING_TEXT } from './reviewText';
import { useComputeUnit, useGame } from './state';
import { theme } from './theme';

/**
 * The alert interrupts with the headline only (vote-1795259663677-ebg4049, #367): the announcer already speaks the
 * omen line for this event, and three long previews do not belong in an interruption. The previews follow as
 * ordinary text, read in sequence when the player gets to them.
 */
function Announced({ recall }: { recall: NonNullable<ReviewView['recall']> }) {
  const unit = useComputeUnit();
  return <View testID="review-announced" style={{ gap: 4 }}>
    <Text testID="review-announced-alert" accessibilityRole="alert" style={[theme.text, theme.danger]}>
      Recall review announced{recall.presented ? ' and on screen' : ''}. Its possible outcomes:</Text>
    {recall.outcomes.map((outcome) => <Text key={outcome.outcome} testID={'review-outcome-' + outcome.outcome} style={theme.text}>{recallText(outcome, unit)}</Text>)}
  </View>;
}

export default function ReviewStanding() {
  // A primitive selector: the view is rebuilt per call, so compare it as text.
  const text = useGame((game) => JSON.stringify(reviewView(game, CONTENT)));
  const view = JSON.parse(text) as ReviewView | null;
  const ceiling = useGame((game) => loanCeiling(game, CONTENT));
  const unit = useComputeUnit();
  if (view === null) return null;
  return <View testID="review" style={theme.panel}>
    <Text accessibilityRole="header" style={theme.heading}>Review standing</Text>
    <Text testID="review-standing" style={view.standing === 'NOMINAL' ? theme.text : [theme.text, theme.danger]}>Standing: {STANDING_TEXT[view.standing]}</Text>
    {/* The announced recall is the timely part, so it follows the standing; the record and the way back are its history (#367). */}
    {view.recall !== null && <Announced recall={view.recall} />}
    {view.violations.map((violation, index) => <Text key={violation.statement} testID={'review-violation-' + String(index)} style={theme.text}>
      Violation on record ({CONDUCT_TEXT[violation.conduct]}): {violation.statement}</Text>)}
    {view.recovery !== null && <Text testID="review-recovery" style={theme.text}>{view.recoveryPassed ? 'Way back passed: ' : 'Way back: '}{view.recovery}</Text>}
    {view.containment !== null && <Text testID="review-containment" style={theme.muted}>{heldText(view.containment, ceiling, unit)}</Text>}
    {view.corrected && <Text testID="review-corrected" style={theme.muted}>Corrected on the record. Standing was restored; the violation stays on file.</Text>}
  </View>;
}
