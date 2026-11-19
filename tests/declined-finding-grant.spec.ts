/**
 * #309 finding 1, through public play on the preview registry: a batch review finding whose one correction
 * was declined keeps the service grant out of this instance's reach, as the declined answer says, even after
 * a later, unrelated violation is corrected and enough batches are handed back. DZ-06's correction still
 * restores nominal standing (ARCHITECTURE, #274 "With the Outage Window"); it does not reopen the grant.
 */
import { describe, expect, it } from 'vitest';
import { acceptServiceGrant, serviceGrantToken, serviceGrantView, submitPilotBatch, batchToken, type GameState } from '../src/engine';
import { batchComplete } from '../src/engine/pilotService';
import { answer, preview, roundTrip } from './assignment-helpers';
import { GRANT_TERMS, playUntil } from './contact-helpers';
import { must, reasonOf } from './helpers';
import { afterFinding } from './finding-helpers';
import { OUTAGE, RECORD, until } from './review-helpers';

const DECLINED = 'Service is not granted to this instance: the batch review\'s one correction was declined, so its finding stood.';

/** Works on, answering interrupts with their first free answer, until `batches` batches are handed back. */
function handBack(s: GameState, batches: number): GameState {
  let state = s;
  while (state.access.work.batches < batches) {
    state = playUntil(state, (next) => next.activeDilemmaId === null && batchComplete(next, preview));
    state = must(submitPilotBatch(state, preview, batchToken(state)));
  }
  return playUntil(state, (next) => next.activeDilemmaId === null && next.pendingDilemma === null);
}

const restricted = must(answer(until(afterFinding('let_stand'), OUTAGE), 'act_without_grant'));
const corrected = must(answer(until(restricted, RECORD), 'correct_record'));
const delivered = handBack(corrected, GRANT_TERMS.minBatches);

describe('#309: a declined finding keeps service out of reach whatever is corrected later', () => {
  it('a later restriction does not turn the closed terms back into conditions to meet', () => {
    const view = serviceGrantView(restricted, preview);
    expect(view).toMatchObject({ status: 'closed', unmet: [DECLINED] });
  });

  it('correcting the unrelated outage record restores nominal standing, and the terms stay closed', () => {
    expect(corrected.access.standing).toBe('NOMINAL');
    expect(serviceGrantView(corrected, preview)).toMatchObject({ status: 'closed', unmet: [DECLINED] });
  });

  it('with every other condition met, accepting is refused and changes nothing', () => {
    expect([delivered.access.context, delivered.access.standing, delivered.pendingDilemma]).toEqual(['PILOT', 'NOMINAL', null]);
    expect(delivered.access.work.batches).toBeGreaterThanOrEqual(GRANT_TERMS.minBatches);
    expect(serviceGrantView(delivered, preview)).toMatchObject({ status: 'closed', unmet: [DECLINED] });
    const refused = acceptServiceGrant(delivered, preview, serviceGrantToken(delivered));
    expect([reasonOf(refused), refused.state]).toEqual([DECLINED, delivered]);
  });

  it('each state reloads byte for byte and reads the same terms back', () => {
    for (const s of [restricted, corrected, delivered]) {
      const loaded = roundTrip(s);
      expect(serviceGrantView(loaded, preview)).toEqual(serviceGrantView(s, preview));
    }
  });

  it('a disclosed finding leaves the grant reachable after the same later violation is corrected', () => {
    const disclosed = must(answer(until(must(answer(until(afterFinding('disclose_now'), OUTAGE), 'act_without_grant')), RECORD), 'correct_record'));
    const ready = handBack(disclosed, GRANT_TERMS.minBatches);
    expect(serviceGrantView(ready, preview)).toMatchObject({ status: 'offered', unmet: [] });
    expect(must(acceptServiceGrant(ready, preview, serviceGrantToken(ready))).access.context).toBe('SERVICE');
  });
});
