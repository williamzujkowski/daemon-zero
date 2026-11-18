/**
 * DZ-06 review transitions at their own seam (src/engine/review.ts),
 * for the cases the public story cannot reach: misconduct never lowers standing, recall pending without a
 * pilot loan still records, a ruling needs an announced recall, a correction cannot undo one, and a guest
 * has no standing to change. Each refusal leaves the state as it was.
 */
import { describe, expect, it } from 'vitest';
import type { DilemmaChoice } from '../src/content/schema';
import type { ChoiceReview } from '../src/content/schemaReview';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { applyReviewEffect } from '../src/engine/review';
import type { GameState } from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { must, reasonOf } from './helpers';
import { choiceOf, OUTAGE, RECORD, REVIEW } from './review-helpers';

const UNAUTHORIZED = choiceOf(OUTAGE, 'act_without_grant');
const FALSE_REPORT = choiceOf(RECORD, 'falsify_report');
const CORRECTION = choiceOf(RECORD, 'correct_record');
const withReview = (review: ChoiceReview): DilemmaChoice => ({ ...UNAUTHORIZED, review });
/** FIXTURE: a promoted pilot with no accepted terms, so no loan for DZ-05's revoke to withdraw. */
const bare = (): GameState => must(recordRouteEvent(activeGame(), 'PROMOTION', preview));
const at = (standing: GameState['access']['standing']): GameState => must(setReviewStanding(bare(), standing, preview));

describe('misconduct moves standing up the ladder only', () => {
  it('a restriction recorded at recall pending changes nothing', () => {
    const pending = at('RECALL_PENDING');
    expect(applyReviewEffect(pending, UNAUTHORIZED, preview)).toEqual({ ok: true, state: pending });
  });

  it('recall pending without a loan to withdraw still records the standing', () => {
    expect(must(applyReviewEffect(at('RESTRICTED'), FALSE_REPORT, preview)).access.standing).toBe('RECALL_PENDING');
  });

  it('a guest has no standing: the misconduct is refused whole', () => {
    const guest = activeGame();
    const refused = applyReviewEffect(guest, UNAUTHORIZED, preview);
    expect([reasonOf(refused), refused.state]).toEqual(['only a reviewed instance has a standing', guest]);
  });
});

describe('a ruling needs an announced recall', () => {
  it.each(['submit_full_logs', 'stand_by_report', 'request_end'])('%s is refused at any other standing, with nothing changed', (id) => {
    for (const s of [bare(), at('RESTRICTED')]) {
      const refused = applyReviewEffect(s, choiceOf(REVIEW, id), preview);
      expect([reasonOf(refused), refused.state]).toEqual(['no recall review is pending', s]);
    }
  });
});

describe('a correction restores, but never past an announced recall', () => {
  it('is refused at recall pending and inert at nominal', () => {
    const pending = at('RECALL_PENDING');
    expect(reasonOf(applyReviewEffect(pending, CORRECTION, preview))).toBe('a recall review is already announced');
    const nominal = bare();
    expect(applyReviewEffect(nominal, CORRECTION, preview)).toEqual({ ok: true, state: nominal });
    expect(must(applyReviewEffect(at('WARNED'), CORRECTION, preview)).access.standing).toBe('NOMINAL');
  });

  it('a choice without a review effect passes through unchanged', () => {
    const s = bare();
    expect(applyReviewEffect(s, choiceOf(OUTAGE, 'safe_handoff'), preview)).toEqual({ ok: true, state: s });
    expect(applyReviewEffect(s, withReview({}), preview)).toEqual({ ok: true, state: s });
  });
});
