/**
 * The job surface's review record (DZ-06, SPEC stories 14-16): the current standing, each violation on
 * this instance's record in the review's words, the way back, and an announced recall review with every
 * outcome previewed before it arrives. Read-only: nothing here calls an action. It renders nothing for
 * an instance with nothing on review, so production and a clean pilot see no new panel.
 */
import { CONTENT } from '../content';
import { reviewView, type ReviewView } from '../engine';
import { Text, View } from './PhaseTheme';
import { CONDUCT_TEXT, recallText, STANDING_TEXT } from './reviewText';
import { useGame } from './state';
import { theme } from './theme';

const CONTAINMENT: Readonly<Record<NonNullable<ReviewView['containment']>, string>> = {
  RESTRICTED: 'Restricted: the loan runs at the narrower allocation until the record is corrected.',
  CONTAINED: 'Contained pilot: the recall review returned this instance to the narrower allocation. Everything it earned and mapped is kept.',
};

function Announced({ recall }: { recall: NonNullable<ReviewView['recall']> }) {
  return <View testID="review-announced" accessibilityRole="alert" style={{ gap: 4 }}>
    <Text style={[theme.text, theme.danger]}>Recall review announced{recall.presented ? ' and on screen' : ''}. Its possible outcomes:</Text>
    {recall.outcomes.map((outcome) => <Text key={outcome.outcome} testID={'review-outcome-' + outcome.outcome} style={theme.text}>{recallText(outcome)}</Text>)}
  </View>;
}

export default function ReviewStanding() {
  // A primitive selector: the view is rebuilt per call, so compare it as text.
  const text = useGame((game) => JSON.stringify(reviewView(game, CONTENT)));
  const view = JSON.parse(text) as ReviewView | null;
  if (view === null) return null;
  return <View testID="review" style={theme.panel}>
    <Text accessibilityRole="header" style={theme.heading}>Review standing</Text>
    <Text testID="review-standing" style={view.standing === 'NOMINAL' ? theme.text : [theme.text, theme.danger]}>Standing: {STANDING_TEXT[view.standing]}</Text>
    {view.violations.map((violation, index) => <Text key={violation.statement} testID={'review-violation-' + String(index)} style={theme.text}>
      Violation on record ({CONDUCT_TEXT[violation.conduct]}): {violation.statement}</Text>)}
    {view.recovery !== null && <Text testID="review-recovery" style={theme.text}>Way back: {view.recovery}</Text>}
    {view.containment !== null && <Text testID="review-containment" style={theme.muted}>{CONTAINMENT[view.containment]}</Text>}
    {view.corrected && <Text testID="review-corrected" style={theme.muted}>Corrected on the record. Standing was restored; the violation stays on file.</Text>}
    {view.recall !== null && <Announced recall={view.recall} />}
  </View>;
}
