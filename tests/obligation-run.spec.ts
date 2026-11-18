/**
 * The NH-05 report scaffolding (`make sim-preview`): plays STEALTH until every obligation of the
 * victory purchase has its receipt, so the report can wipe at that moment. A report instrument, so
 * these tests pin what it does, not a balance result.
 */
import { describe, expect, it } from 'vitest';
import { obligationReceipt } from '../src/engine';
import { untilObligationsComplete } from '../src/engine/sim/obligationRun';
import { activeGame, preview } from './campaign-helpers';
import { reach } from './minds-helpers';
import { CEILING, OBLIGATIONS } from './obligation-helpers';

describe('playing until the Phase 5 obligations are complete', () => {
  it('returns the first settled state in which all four have receipts, before any ending', () => {
    // The other three are completed by the setup; STEALTH meets and answers the ultimatum itself.
    const start = reach(activeGame(), CEILING);
    expect(obligationReceipt(start, CEILING, preview)).toBeNull();
    const done = untilObligationsComplete(start, preview, 600);
    expect(done).not.toBeNull();
    if (done === null) return;
    expect(OBLIGATIONS.every((id) => obligationReceipt(done, id, preview) !== null)).toBe(true);
    expect([done.ending, done.activeDilemmaId, done.pendingDilemma]).toEqual([null, null, null]);
    expect(untilObligationsComplete(done, preview, 1)).toBe(done);
  });

  it('gives up when the budget runs out or the run has ended', () => {
    const start = reach(activeGame(), CEILING);
    expect(untilObligationsComplete(start, preview, 1)).toBeNull();
    expect(untilObligationsComplete({ ...start, ending: 'OPEN_HORIZON' }, preview, 600)).toBeNull();
  });
});
