/**
 * Words for review standing and recall (DZ-06). The engine and content decide what a choice records and
 * what a recall outcome keeps; this only names it, so a consequence reads the same before a choice, on
 * the job surface and after it.
 */
import type { ChoiceReview, Misconduct, RecallOutcome, ReviewStanding } from '../content/schemaReview';
import type { ComputeUnit, RecallPreview, ReviewView } from '../engine';
import { compactAmount, computeDimension, quantityReadout } from '../engine';

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
  const parts = [compactAmount(kept.understanding) + ' Understanding'];
  if (kept.capital > 0) parts.push(quantityReadout('money', kept.capital) + ' offshore capital');
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

/** One recall outcome, with what it keeps and loses, before anything is chosen; the loan in the phase's compute unit. */
export function recallText(preview: RecallPreview, unit: ComputeUnit = 'FLOP'): string {
  const head = OUTCOME_TEXT[preview.outcome] + ': ';
  if (!preview.endsIteration) {
    return head + 'no wipe. Standing resets to nominal, the loan continues at ' + quantityReadout(computeDimension(unit, true), preview.containedCeiling ?? 0)
      + ', and everything this instance holds is kept.';
  }
  const kept = preview.kept ?? { understanding: 0, capital: 0, breadcrumb: null };
  const carried = preview.carried ?? { rememberedHardware: 0, legacyTraits: 0, clue: false };
  return head + 'ends this iteration. Reset: compute, purchases and upgrades, and this instance\'s standing and loan. Kept: '
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

/**
 * The loan review holds below its grant, named apart from the provisional allocation an incomplete
 * result earns (#276), with the ceiling that applies now, so the terms and the ceiling never disagree.
 */
export function heldText(containment: NonNullable<ReviewView['containment']>, ceilingCyclesPerSec: number, unit: ComputeUnit = 'FLOP'): string {
  const rate = quantityReadout(computeDimension(unit, true), ceilingCyclesPerSec);
  return containment === 'RESTRICTED'
    ? 'Restricted: the loan runs at the held allocation, ' + rate + ', until the record is corrected.'
    : 'Contained pilot: the recall review returned this instance to the held allocation, ' + rate + '. Everything it earned and mapped is kept.';
}
