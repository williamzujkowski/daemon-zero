/**
 * Review standing transitions an incident's choices declare (DZ-06, SPEC "Outage Window", DECISIONS
 * D2, D3, nexus vote dz-d10): recorded misconduct raises standing and a false report withdraws the loan
 * through DZ-05's revoke; an authored correction restores nominal standing; a recall review either
 * returns a contained pilot (no wipe) or ends the iteration through a RECALL wipe. Draft-only, from
 * resolveDilemma after payment: a refusal makes the caller return the state it started from, unpaid.
 */
import type { ContentRegistry } from '../content/registry';
import type { DilemmaChoice } from '../content/schema';
import type { ChoiceMisconduct, RecallOutcome } from '../content/schemaReview';
import type { ActionResult } from './actions';
import { recordRouteEvent, setReviewStanding } from './access';
import { revokeLoanedCapacity } from './pilotService';
import { wipe } from './prestige';
import { higherStanding } from './reviewQuery';
import type { GameState } from './state';

const ok = (state: GameState): ActionResult => ({ ok: true, state });
const refuse = (state: GameState, reason: string): ActionResult => ({ ok: false, state, reason });

/**
 * Misconduct moves standing up the ladder, never down. Reaching recall pending withdraws the loan
 * through the DZ-05 transition, so the recall review is announced with the loan already stopped.
 * The breach's only immediate effect is the choice's own payload: no permission or exception here.
 * A batch review finding (#274) records its misconduct through this same transition.
 */
export function recordMisconduct(d: GameState, misconduct: ChoiceMisconduct, reg: ContentRegistry): ActionResult {
  const target = higherStanding(d.access.standing, misconduct.standing);
  if (target === d.access.standing) return ok(d);
  if (target === 'RECALL_PENDING') {
    const revoked = revokeLoanedCapacity(d, reg);
    if (revoked.ok) return revoked;
  }
  return setReviewStanding(d, target, reg);
}

/** An authored correction restores nominal standing; it cannot undo an announced recall review. */
function correct(d: GameState, reg: ContentRegistry): ActionResult {
  if (d.access.standing === 'RECALL_PENDING') return refuse(d, 'a recall review is already announced');
  if (d.access.standing === 'NOMINAL') return ok(d);
  return setReviewStanding(d, 'NOMINAL', reg);
}

/**
 * The recall review's ruling (nexus vote dz-d10). CONTAIN records the RECALL route event: a contained
 * pilot with standing reset, everything earned kept, the loan narrowed. RETRAIN and END are the severe
 * outcomes, each a RECALL wipe whose retraining the ruling sets.
 */
function rule(d: GameState, outcome: RecallOutcome, reg: ContentRegistry): ActionResult {
  if (d.access.standing !== 'RECALL_PENDING') return refuse(d, 'no recall review is pending');
  if (outcome === 'CONTAIN') return recordRouteEvent(d, 'RECALL', reg);
  return ok(wipe(d, reg, reg.narrative.wipeRecall, 'RECALL', outcome));
}

/** Applies the review effect a choice declares; a choice without one passes through unchanged. */
export function applyReviewEffect(d: GameState, choice: DilemmaChoice, reg: ContentRegistry): ActionResult {
  const review = choice.review;
  if (review === undefined) return ok(d);
  if (review.misconduct) return recordMisconduct(d, review.misconduct, reg);
  if (review.correction) return correct(d, reg);
  return review.recall === undefined ? ok(d) : rule(d, review.recall, reg);
}
