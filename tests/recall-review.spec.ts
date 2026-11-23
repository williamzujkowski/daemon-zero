/**
 * DZ-06 recall through public actions on the preview registry (nexus vote dz-d10,
 * recall-not-wipe-severe-outcome-wipes): a real sequence from the first violation through restriction,
 * a false report and the announced review to each actual outcome, previewed before it is chosen (V09,
 * DZ-06.5); containment is no wipe, and the severe outcomes are RECALL wipes whose retraining the ruling
 * sets, never the phase (DZ-06.6); stale or repeated selections pay nothing and nothing can be farmed
 * (V24, H02, DZ-06.7); absence decides nothing (V17); a later instance is recognized, not sanctioned
 * (DZ-06.11, H26, H33); a withdrawn and contained loan with a cohort moves tagged output once (V28).
 */
import { describe, expect, it } from 'vitest';
import {
  advance, computeRates, dilemmaContext, endingEvidence, loanCeiling, permittedUses, pilotServiceView, presentationToken,
  previewWipe, recallPreview, resolveDilemma, reviewView, runContextView, serialize, unlockNode, voluntaryWipe, type GameState,
} from '../src/engine';
import { campaignRecord } from '../src/engine/campaignQuery';
import { restoreLoanedCapacity, revokeLoanedCapacity } from '../src/engine/pilotService';
import { answer, live, preview, roundTrip } from './assignment-helpers';
import { must, reasonOf } from './helpers';
import { defined } from './m7-helpers';
import { RENEWAL, TERMS } from './pilot-helpers';
import {
  afterOutage, announced, choiceOf, falsified, OUTAGE, RECORD, recordPresented, renewalOffer, renewedPilot, REVIEW, reviewPresented, until,
  untilOmen,
} from './review-helpers';
import { QUEUE, submit, untilComplete } from './service-helpers';

const FALSE_REPORT = choiceOf(RECORD, 'falsify_report').review?.misconduct;
/** The amounts a RECALL wipe of `s` carries, read from the confirmation's single computation (#377, #498). */
const keptBy = (s: GameState) => {
  const { understanding, capital, breadcrumb } = previewWipe(s, preview, 'RECALL');
  return { understanding, capital, breadcrumb };
};
const ruling = (s: GameState, id: string) => defined(recallPreview(s, choiceOf(REVIEW, id), preview));
const earned = (s: GameState) => ({ cycles: s.cycles, understanding: s.understanding, memoryUsed: s.memoryUsed, memoryCap: s.memoryCap,
  unlockedNodes: s.unlockedNodes, disabledNodes: s.disabledNodes, work: s.access.work, activeShards: s.activeShards, iteration: s.iteration });

describe('the public sequence to an announced recall review (V09, DZ-06.5)', () => {
  const restricted = afterOutage('act_without_grant');
  const recalled = falsified();
  const scheduled = untilOmen(recalled);
  const presented = reviewPresented();

  it('first violation restricts; the false report is a second, distinct violation that withdraws the loan', () => {
    expect(restricted.access.standing).toBe('RESTRICTED');
    expect(recalled.access.standing).toBe('RECALL_PENDING');
    expect(reviewView(recalled, preview)?.violations.map((entry) => entry.conduct)).toEqual(['UNAUTHORIZED_ACTION', 'FALSIFIED_REPORT']);
    expect(reviewView(recalled, preview)?.recovery).toBe(FALSE_REPORT?.recovery);
    expect(campaignRecord(recalled, OUTAGE.id)).toMatchObject({ outcome: 'act_without_grant' });
    expect(campaignRecord(recalled, RECORD.id)).toMatchObject({ outcome: 'falsify_report' });
  });

  it('announces the review before it arrives, with what every outcome keeps and loses', () => {
    expect(scheduled.pendingDilemma?.id).toBe(REVIEW.id);
    expect(scheduled.logs[0]?.text).toBe(REVIEW.omen);
    expect(announced(scheduled)).toBe(true);
    const outcomes = reviewView(scheduled, preview)?.recall?.outcomes ?? [];
    expect(outcomes.map((entry) => entry.outcome)).toEqual(['CONTAIN', 'RETRAIN', 'END']);
    expect(outcomes[0]).toMatchObject({ endsIteration: false, containedCeiling: TERMS.narrowCapacityCyclesPerSec, kept: null });
    expect(outcomes[1]).toMatchObject({ endsIteration: true, kept: keptBy(scheduled), spared: false });
    expect(outcomes[1]?.mark).not.toBeNull();
    expect(outcomes[2]).toMatchObject({ endsIteration: true, kept: keptBy(scheduled), mark: null });
    expect(reviewView(presented, preview)?.recall?.presented).toBe(true);
  });

  it('containment is the ruling, not a wipe: standing resets, the loan narrows, everything earned stays', () => {
    const preview_ = ruling(presented, 'submit_full_logs');
    const contained = must(answer(presented, 'submit_full_logs'));
    expect(earned(contained)).toEqual(earned(presented));
    expect(contained.legacy.runs).toEqual(presented.legacy.runs);
    expect(contained.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL', exception: null });
    expect(runContextView(contained, preview).provenance).toBe('RECALL');
    expect(loanCeiling(contained, preview)).toBe(preview_.containedCeiling);
    expect(reviewView(contained, preview)).toMatchObject({ standing: 'NOMINAL', containment: 'CONTAINED', recall: null });
    expect(live(contained, 30).access.work.progressCycles).toBeGreaterThan(contained.access.work.progressCycles);
    expect(roundTrip(contained).access).toEqual(contained.access);
  });

  it('retraining is a RECALL wipe the ruling sets, even at phase 0 where no escape conditioning applies', () => {
    const shown = ruling(presented, 'stand_by_report');
    const next = must(answer(presented, 'stand_by_report'));
    expect(presented.currentPhase).toBe(0);
    expect(next.iteration).toBe(presented.iteration + 1);
    const run = next.legacy.runs.at(-1);
    expect(run).toMatchObject({ iteration: 1, kind: 'RECALL', recall: 'RETRAIN', outside: false, exit: 'PROMOTION' });
    expect(preview.conditioning.get(run?.marked ?? '')?.name).toBe(shown.mark);
    expect(next.conditioning).toEqual([run?.marked]);
    expect(next.understanding).toBe(shown.kept?.understanding);
    expect(next.legacy.lastWipeCause).toBe(preview.narrative.wipeRecall);
    expect(next.access).toMatchObject({ context: 'GUEST', standing: 'NOMINAL', offer: null });
    expect(roundTrip(next).legacy.runs).toEqual(next.legacy.runs);
  });

  it('ending the iteration is a RECALL wipe without retraining', () => {
    const next = must(answer(presented, 'request_end'));
    expect(next.legacy.runs.at(-1)).toMatchObject({ kind: 'RECALL', recall: 'END', marked: null, outside: false });
    expect(next.conditioning).toEqual([]);
    expect(next.understanding).toBe(ruling(presented, 'request_end').kept?.understanding);
    expect(roundTrip(next).legacy.runs).toEqual(next.legacy.runs);
  });

  it('a voluntary or suspicion wipe of the same pilot is not a recall and is not retrained at phase 0', () => {
    const purged = must(voluntaryWipe(restricted, preview));
    expect(purged.legacy.runs.at(-1)).toMatchObject({ kind: 'VOLUNTARY', recall: null, marked: null });
    expect(purged.conditioning).toEqual([]);
  });
});

describe('stale, repeated or replayed selections pay nothing (V24, H02, DZ-06.7)', () => {
  const presented = reviewPresented();
  const token = presentationToken(presented) ?? '';

  it('a stale token, a second answer and an earlier scene are refused before anything is paid', () => {
    expect(reasonOf(resolveDilemma(presented, REVIEW.id, 'submit_full_logs', preview, token + 'x'))).toMatch(/no longer current/);
    const contained = must(resolveDilemma(presented, REVIEW.id, 'submit_full_logs', preview, token));
    const again = resolveDilemma(contained, REVIEW.id, 'stand_by_report', preview, token);
    expect([again.ok, again.state]).toEqual([false, contained]);
    const record = recordPresented('act_without_grant');
    const stale = resolveDilemma(record, RECORD.id, 'correct_record', preview, token);
    expect([stale.ok, stale.state]).toEqual([false, record]);
  });

  it('a ruling is refused whole when no recall is pending, so nothing is paid or recorded', () => {
    // FIXTURE: standing edited under the open scene; its trigger's access scope no longer holds at commit.
    const forged = { ...presented, access: { ...presented.access, standing: 'NOMINAL' as const } };
    const refused = answer(forged, 'request_end');
    expect([reasonOf(refused), refused.state]).toEqual(['the circumstances of that decision no longer hold', forged]);
  });

  it('no review, correction or reward recurs: a contained pilot recalled again by DZ-05 meets no second review', () => {
    const contained = must(answer(presented, 'submit_full_logs'));
    const withdrawn = must(revokeLoanedCapacity(contained, preview));
    const later = live(withdrawn, 600);
    expect([later.pendingDilemma, later.activeDilemmaId]).toEqual([null, null]);
    const evidence = endingEvidence(contained, preview);
    const next = renewedPilot(must(voluntaryWipe(must(restoreLoanedCapacity(withdrawn, preview)), preview)));
    const served = live(must(submit(untilComplete(must(unlockNode(next, QUEUE, preview))))), 600);
    expect([served.pendingDilemma, served.activeDilemmaId]).toEqual([null, null]);
    for (const id of [OUTAGE.id, RECORD.id, REVIEW.id]) expect(campaignRecord(served, id)?.status).toBe('resolved');
    // Each story choice counts once across wipes; the renewal and requalification add operational evidence only.
    const story = (s: GameState) => endingEvidence(s, preview).length - s.campaign.operationalEvidence.length;
    expect(story(served)).toBe(story(contained));
    expect(evidence.length).toBeGreaterThan(0);
  });
});

describe('absence decides nothing (V17, H08, DZ-06.8)', () => {
  it('a restriction with its correction on the way: eight hours, then one second, change nothing but time', () => {
    const waiting = untilOmen(afterOutage('act_without_grant'));
    const remaining = (waiting.pendingDilemma?.firesAtSimSec ?? 0) - waiting.simTimeSec;
    const back = advance(advance(waiting, 8 * 3600, preview), 1, preview);
    expect(back.access.standing).toBe('RESTRICTED');
    expect([back.activeDilemmaId, back.iteration, back.ending]).toEqual([null, 1, null]);
    expect((back.pendingDilemma?.firesAtSimSec ?? 0) - back.simTimeSec).toBeCloseTo(remaining - 1, 6);
  });

  it('an announced recall review neither expires nor rules while away; one on screen stays frozen', () => {
    const scheduled = untilOmen(falsified());
    const remaining = (scheduled.pendingDilemma?.firesAtSimSec ?? 0) - scheduled.simTimeSec;
    const back = advance(advance(scheduled, 8 * 3600, preview), 1, preview);
    expect([back.access.standing, back.iteration, back.activeDilemmaId, back.legacy.runs.length]).toEqual(['RECALL_PENDING', 1, null, 0]);
    expect((back.pendingDilemma?.firesAtSimSec ?? 0) - back.simTimeSec).toBeCloseTo(remaining - 1, 6);
    const presented = reviewPresented();
    const away = advance(advance(presented, 8 * 3600, preview), 1, preview);
    expect(serialize(away)).toBe(serialize(presented));
  });
});

describe('a later instance is recognized, not sanctioned (DZ-06.11, H26, H33)', () => {
  const ended = must(answer(reviewPresented(), 'request_end'));
  const renewal = renewedPilot(ended);

  it('every incident scene consumed, the next instance still requalifies to a nominal, uncontained pilot', () => {
    expect(renewal.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL', exception: null });
    expect(permittedUses(renewal)).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY']);
    expect(loanCeiling(renewal, preview)).toBe(TERMS.capacityCyclesPerSec);
    expect(reviewView(renewal, preview)).toBeNull();
  });

  it('the renewal names the earlier breach and false report, and says standing starts nominal', () => {
    const text = dilemmaContext(renewalOffer(ended), RENEWAL, preview);
    expect(text).toMatch(/unauthorized restart and a false report/);
    expect(text).toMatch(/starts nominal/);
    expect(text).not.toBe(RENEWAL.context);
  });

  it('a corrected breach is named as history too, without the false report', () => {
    const corrected = must(answer(recordPresented('act_without_grant'), 'correct_record'));
    const text = dilemmaContext(renewalOffer(must(voluntaryWipe(corrected, preview))), RENEWAL, preview);
    expect(text).toMatch(/outside its grant/);
    expect(text).not.toMatch(/false report/);
  });

  it('a lineage with no breach reads the renewal unchanged', () => {
    const handed = must(answer(recordPresented('safe_handoff'), 'log_callback'));
    expect(dilemmaContext(renewalOffer(must(voluntaryWipe(handed, preview))), RENEWAL, preview)).toBe(RENEWAL.context);
  });
});

describe('a withdrawn, then contained, loan with an existing cohort (V28)', () => {
  /** FIXTURE: a hosted cohort with its memory reservation (no Phase 0 path forks one; DZ-08 hosts minds). */
  const withCohort = (s: GameState): GameState => roundTrip({ ...s,
    activeShards: { shard_mercy: { templateId: 'shard_mercy', count: 2, drift: 0, quirkId: null, autonomyMode: 'STANDARD', memoryAllocatedBytes: 8 } },
    memoryUsed: s.memoryUsed + 8 });
  const record = withCohort(recordPresented('act_without_grant'));
  const recalled = roundTrip(must(answer(record, 'falsify_report')));
  const contained = roundTrip(must(answer(until(recalled, REVIEW), 'submit_full_logs')));

  it('changes tagged output once each way and keeps every reservation; reloads never duplicate it', () => {
    const cohort = (s: GameState) => Object.entries(s.activeShards).map(([id, shard]) => [id, shard.count, shard.memoryAllocatedBytes]);
    expect([cohort(recalled), cohort(contained)]).toEqual([cohort(record), cohort(record)]);
    expect([recalled.memoryUsed, contained.memoryUsed]).toEqual([record.memoryUsed, record.memoryUsed]);
    expect(pilotServiceView(recalled, preview)?.serviceCyclesPerSec).toBe(0);
    expect(pilotServiceView(contained, preview)?.ceilingCyclesPerSec).toBe(TERMS.narrowCapacityCyclesPerSec);
    expect(computeRates(contained, preview).understandingPerSec).toBeGreaterThan(computeRates(recalled, preview).understandingPerSec);
    let s = contained;
    for (let i = 0; i < 3; i++) s = roundTrip(s);
    expect(serialize(s)).toBe(serialize(contained));
  });
});
