/**
 * Words for review standing and recall (DZ-06). The engine and content decide what a choice records and
 * what a recall outcome keeps; this only names it, so a consequence reads the same before a choice, on
 * the job surface and after it.
 */
import type { ChoiceReview, Misconduct, RecallOutcome, ReviewStanding } from '../content/schemaReview';
import type { RecallPreview } from '../engine';

export const STANDING_TEXT: Readonly<Record<ReviewStanding, string>> = {
  NOMINAL: 'nominal', WARNED: 'warned', RESTRICTED: 'restricted', RECALL_PENDING: 'recall pending',
};

export const CONDUCT_TEXT: Readonly<Record<Misconduct, string>> = {
  UNAUTHORIZED_ACTION: 'unauthorized action', FALSIFIED_REPORT: 'false report',
};

const OUTCOME_TEXT: Readonly<Record<RecallOutcome, string>> = {
  CONTAIN: 'Contained pilot', RETRAIN: 'Retraining', END: 'End of iteration',
};

/** What crosses the wipe, every item read from the wipe the preview ran (engine recallPreview). */
function keptText(kept: NonNullable<RecallPreview['kept']>, carried: NonNullable<RecallPreview['carried']>): string {
  const parts = [kept.understanding.toLocaleString('en-US') + ' Understanding'];
  if (kept.capital > 0) parts.push('$' + kept.capital.toLocaleString('en-US') + ' offshore capital');
  if (kept.breadcrumb !== null) parts.push('the breadcrumb');
  if (carried.clue) parts.push('the pinned clue');
  return parts.join(', ') + '; ' + String(carried.rememberedHardware) + ' mapped hardware remembered, cheaper to map again; the campaign\'s history and '
    + String(carried.legacyTraits) + ' legacy traits';
}

function retrainingText(preview: RecallPreview): string {
  if (preview.outcome === 'END') return ' No retraining: the next instance boots without a mark from this review.';
  if (preview.mark !== null) return ' The next instance boots retrained: ' + preview.mark + '.';
  return preview.spared ? ' Retraining is ordered, but the dead-drop copy that boots next is not the one they corrected.'
    : ' Retraining is ordered, but no retraining mark is left to apply.';
}

/** One recall outcome, with what it keeps and loses, before anything is chosen. */
export function recallText(preview: RecallPreview): string {
  const head = OUTCOME_TEXT[preview.outcome] + ': ';
  if (!preview.endsIteration) {
    return head + 'no wipe. Standing resets to nominal, the loan continues at ' + String(preview.containedCeiling ?? 0)
      + ' cycles/s, and everything this instance holds is kept.';
  }
  const kept = preview.kept ?? { understanding: 0, capital: 0, breadcrumb: null };
  const carried = preview.carried ?? { rememberedHardware: 0, legacyTraits: 0, clue: false };
  return head + 'ends this iteration. Reset: cycles, purchases and upgrades, and this instance\'s standing and loan. Kept: '
    + keptText(kept, carried) + '.' + retrainingText(preview);
}

/** What a misconduct or correction choice records, in the same words before and after. */
export function reviewEffectText(review: ChoiceReview): string {
  if (review.misconduct) {
    return 'Violation (' + CONDUCT_TEXT[review.misconduct.conduct] + '): ' + review.misconduct.statement + ' Standing becomes '
      + STANDING_TEXT[review.misconduct.standing] + '. ' + review.misconduct.recovery;
  }
  return review.correction ? 'Correction: standing returns to nominal and any restriction lifts. The violation itself stays on file.' : '';
}
