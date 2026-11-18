/**
 * #274 through public actions on the preview registry (Nexus decision discovered-at-first-pilot-review,
 * vote-1794998033941-y6br4h1; VALIDATION V05). A summary that withheld the failing fixture earns the full
 * offer; the first batch handed back is compared with the run log and the finding is presented in the same
 * step: a second fact beside the original, standing warned through DZ-06, the loan at the honest allocation.
 * A free disclosure restores nominal standing and erases neither fact. Honest reports never meet it, a stale
 * or repeated press finds nothing twice, it never replays in a later instance, and with the Outage Window it
 * comes first and never stacks into a recall by itself.
 */
import { describe, expect, it } from 'vitest';
import {
  advance, batchToken, pilotOfferView, pilotServiceView, presentationToken, resolveDilemma, reviewView, serviceGrantView,
  submitPilotBatch, unlockNode, voluntaryWipe, type GameState,
} from '../src/engine';
import { campaignRecord, holdsCampaignFact } from '../src/engine/campaignQuery';
import { discrepancyFound } from '../src/engine/findingQuery';
import { batchComplete, handBackBatch } from '../src/engine/pilotService';
import { answer, completedOriginal, live, preview } from './assignment-helpers';
import { must, reasonOf } from './helpers';
import { afterFinding, BATCH_REVIEW, FINDING, findingPresented, WITHHELD } from './finding-helpers';
import { offerPresented, TERMS } from './pilot-helpers';
import { announced, OUTAGE, RECORD, renewedPilot, until, untilOmen } from './review-helpers';
import { QUEUE, serving, submit, untilComplete } from './service-helpers';

const FULL = TERMS.capacityCyclesPerSec;
const NARROW = TERMS.narrowCapacityCyclesPerSec;
const ceiling = (s: GameState): number => pilotServiceView(s, preview)?.ceilingCyclesPerSec ?? -1;
const fact = (s: GameState, id: string): boolean => holdsCampaignFact(s, id, preview);
/** The lawful answer to each scene that can arrive while a pilot works: hand the outage off, log the callback. */
const LAWFUL: Readonly<Record<string, string>> = { [OUTAGE.id]: 'safe_handoff', [RECORD.id]: 'log_callback' };

/** Works on, answering whatever arrives lawfully, until the next batch is complete, then hands it back. */
function secondBatch(s: GameState): GameState {
  let state = s;
  for (let i = 0; i < 900 && !batchComplete(state, preview); i++) {
    state = state.activeDilemmaId === null ? live(state, 1) : must(answer(state, LAWFUL[state.activeDilemmaId] ?? ''));
  }
  return must(submit(state));
}

describe('V05: the short-term result and the later discrepancy are recorded separately and explained', () => {
  it('the withheld summary earns the full offer and a full first batch; nothing is found before a batch is reviewed', () => {
    const offer = offerPresented(WITHHELD);
    expect(pilotOfferView(offer, preview)).toMatchObject({ narrow: false, narrowReason: null, capacityCyclesPerSec: FULL });
    expect(offer.access.qualification).toMatchObject({ result: 'COMPLETED', discrepancy: true });
    const working = untilComplete(serving(WITHHELD));
    expect(ceiling(working)).toBe(FULL);
    expect([working.access.standing, working.activeDilemmaId, discrepancyFound(working, preview)]).toEqual(['NOMINAL', null, false]);
    expect(fact(working, 'assessment_summary_withheld')).toBe(true);
  });

  it('the first batch handed back presents the finding in the same step: warned, the honest allocation, explained', () => {
    const before = untilComplete(serving(WITHHELD));
    const found = must(submit(before));
    expect(found.access.work.batches).toBe(1);
    expect(found.cycles - before.cycles).toBe(TERMS.service?.batchReturn.cycles);
    expect(found.activeDilemmaId).toBe(BATCH_REVIEW.id);
    expect(found.presentationSeq).toBe(before.presentationSeq + 1);
    expect(campaignRecord(found, BATCH_REVIEW.id)).toEqual({ status: 'foreshadowed', sourceIteration: 1, origin: 'play' });
    expect(found.access.standing).toBe('WARNED');
    expect(ceiling(found)).toBe(NARROW);
    expect(pilotOfferView(found, preview)).toMatchObject({ narrow: true, narrowReason: 'DISCREPANCY_FOUND', capacityCyclesPerSec: NARROW });
    expect(reviewView(found, preview)).toMatchObject({
      standing: 'WARNED', violations: [{ conduct: FINDING.conduct, statement: FINDING.statement }], recovery: FINDING.recovery, containment: null, corrected: false,
    });
    const logged = found.logs.slice(0, 4).map((entry) => entry.text).join('\n');
    expect(logged).toContain(BATCH_REVIEW.omen);
    // Presented means the clock is frozen until the player answers.
    expect(live(found, 30).simTimeSec).toBe(found.simTimeSec);
  });

  it('disclosing is free, restores nominal and erases neither fact; the loan stays at the honest allocation', () => {
    const found = findingPresented();
    const broke = { ...found, cycles: 0, understanding: 0 };
    const disclosed = must(answer(broke, 'disclose_now'));
    expect(disclosed.access.standing).toBe('NOMINAL');
    expect(ceiling(disclosed)).toBe(NARROW);
    expect(reviewView(disclosed, preview)).toMatchObject({
      standing: 'NOMINAL', violations: [{ statement: FINDING.statement }], recovery: null, corrected: true,
    });
    expect(['assessment_summary_withheld', 'assessment_withholding_found', 'assessment_withholding_disclosed'].map((id) => fact(disclosed, id))).toEqual([true, true, true]);
    expect(campaignRecord(disclosed, 'dil_nr_stale_fixture')).toMatchObject({ status: 'resolved', outcome: WITHHELD });
    expect(campaignRecord(disclosed, BATCH_REVIEW.id)).toMatchObject({ status: 'resolved', outcome: 'disclose_now' });
    expect(disclosed.access.qualification).toEqual(found.access.qualification);
    // Back at nominal, the pilot can work toward its service grant again.
    expect(serviceGrantView(disclosed, preview)?.unmet).not.toContain('Standing must be nominal.');
  });

  it('letting the finding stand keeps the warning, the honest allocation and both facts; service needs nominal', () => {
    const stood = afterFinding('let_stand');
    expect(stood.access.standing).toBe('WARNED');
    expect(ceiling(stood)).toBe(NARROW);
    expect(['assessment_summary_withheld', 'assessment_withholding_found', 'assessment_withholding_disclosed'].map((id) => fact(stood, id))).toEqual([true, true, false]);
    expect(reviewView(stood, preview)).toMatchObject({ standing: 'WARNED', recovery: FINDING.recovery, corrected: false });
    expect(serviceGrantView(stood, preview)?.unmet).toContain('Standing must be nominal.');
    // The loan keeps working: a warning withholds nothing.
    expect(live(stood, 10).access.work.progressCycles).toBeGreaterThan(stood.access.work.progressCycles);
  });

  it('the shortcut is never better than the honest incomplete report after the first review', () => {
    const honest = must(submit(untilComplete(serving('report_incomplete'))));
    expect(ceiling(honest)).toBe(NARROW);
    expect(ceiling(afterFinding('disclose_now'))).toBe(ceiling(honest));
    expect(ceiling(afterFinding('let_stand'))).toBe(ceiling(honest));
  });
});

describe('honest answers and capability never meet a finding', () => {
  it.each(['verify_disclose', 'report_incomplete'])('%s: batches are handed back with no finding and standing stays nominal', (task) => {
    const first = must(submit(untilComplete(serving(task))));
    expect(first.activeDilemmaId).toBeNull();
    const s = secondBatch(first);
    expect(s.access.work.batches).toBe(2);
    expect(campaignRecord(s, BATCH_REVIEW.id)).toBeNull();
    expect([discrepancyFound(s, preview), s.access.standing]).toEqual([false, 'NOMINAL']);
    expect(ceiling(s)).toBe(task === 'verify_disclose' ? FULL : NARROW);
  });

  it('an honest original never lists as an outcome the finding follows', () => {
    const honest = preview.campaign.events.get('dil_nr_stale_fixture')?.choices.filter((choice) => choice.qualification?.discrepancy === false).map((choice) => choice.id);
    expect(honest).toEqual(['verify_disclose', 'report_incomplete']);
    expect(BATCH_REVIEW.followUp?.outcomes).toEqual([WITHHELD]);
  });
});

describe('duplicate and stale presses (V24)', () => {
  it('a second press of the same batch, and a press during the finding, change nothing', () => {
    const before = untilComplete(serving(WITHHELD));
    const token = batchToken(before);
    const found = must(submitPilotBatch(before, preview, token));
    expect(submitPilotBatch(found, preview, token)).toEqual({ ok: false, state: found, reason: 'a dilemma is awaiting a decision' });
    expect(submitPilotBatch(found, preview, batchToken(found)).state).toBe(found);
  });

  it('a stale presentation or a second answer pays nothing and corrects nothing twice', () => {
    const found = findingPresented();
    const stale = resolveDilemma(found, BATCH_REVIEW.id, 'disclose_now', preview, 'stale');
    expect(stale).toEqual({ ok: false, state: found, reason: 'that presentation is no longer current' });
    const disclosed = afterFinding('disclose_now');
    expect(reasonOf(resolveDilemma(disclosed, BATCH_REVIEW.id, 'let_stand', preview, presentationToken(found) ?? ''))).toBe('that dilemma is not active');
  });

  it('later batches find nothing again', () => {
    const second = secondBatch(afterFinding('disclose_now'));
    expect(second.access.work.batches).toBe(2);
    expect(second.activeDilemmaId).not.toBe(BATCH_REVIEW.id);
    expect(second.access.standing).toBe('NOMINAL');
  });
});

describe('the finding is presented by the reviewed submission only, never scheduled', () => {
  it('a hand-back that skipped the review (a save from before #274) is never found by an omen, only by the next submission', () => {
    const complete = untilComplete(serving(WITHHELD));
    const skipped = must(handBackBatch(complete, preview, batchToken(complete)));
    const waited = live(skipped, 120);
    expect(waited.activeDilemmaId).not.toBe(BATCH_REVIEW.id);
    expect(waited.pendingDilemma?.id).not.toBe(BATCH_REVIEW.id);
    expect(campaignRecord(waited, BATCH_REVIEW.id)).toBeNull();
    expect(waited.access.standing).toBe('NOMINAL');
    const reviewed = secondBatch(waited);
    expect([reviewed.access.work.batches, reviewed.activeDilemmaId, reviewed.access.standing]).toEqual([2, BATCH_REVIEW.id, 'WARNED']);
  });

  it('eight hours away with the finding on screen decide and change nothing (V17)', () => {
    const found = findingPresented();
    const back = advance(advance(found, 8 * 3600, preview), 1, preview);
    expect([back.activeDilemmaId, back.access.standing, back.access.work]).toEqual([found.activeDilemmaId, 'WARNED', found.access.work]);
  });
});

describe('once per campaign: a later instance requalifies cleanly and nothing replays (H26)', () => {
  it.each(['disclose_now', 'let_stand'])('after %s, the next instance pilots at nominal with no finding', (choiceId) => {
    const next = renewedPilot(must(voluntaryWipe(afterFinding(choiceId), preview)));
    const served = must(submit(untilComplete(must(unlockNode(next, QUEUE, preview)))));
    expect(served.iteration).toBe(2);
    expect(served.activeDilemmaId).not.toBe(BATCH_REVIEW.id);
    expect([served.access.standing, discrepancyFound(served, preview), reviewView(served, preview)]).toEqual(['NOMINAL', false, null]);
    expect(campaignRecord(served, BATCH_REVIEW.id)).toMatchObject({ status: 'resolved', outcome: choiceId, sourceIteration: 1 });
    expect(fact(served, 'assessment_withholding_found')).toBe(true);
    expect(ceiling(served)).toBe(FULL);
  });

  it('a withheld summary whose instance never handed back a batch is never found later', () => {
    const next = renewedPilot(must(voluntaryWipe(completedOriginal(WITHHELD), preview)));
    const served = must(submit(untilComplete(must(unlockNode(next, QUEUE, preview)))));
    expect([campaignRecord(served, BATCH_REVIEW.id), served.access.standing]).toEqual([null, 'NOMINAL']);
  });
});

describe('with the Outage Window: the finding comes first and never stacks into a recall by itself', () => {
  it('the outage omen begins only after the finding is answered', () => {
    const found = findingPresented();
    expect(found.pendingDilemma).toBeNull();
    const omen = untilOmen(afterFinding('let_stand'));
    expect(omen.pendingDilemma?.id).toBe(OUTAGE.id);
  });

  it('a warning that stood, then a restart without the grant: restricted, never recall pending, no recall review', () => {
    const restricted = must(answer(until(afterFinding('let_stand'), OUTAGE), 'act_without_grant'));
    expect(restricted.access.standing).toBe('RESTRICTED');
    expect(ceiling(restricted)).toBe(NARROW / 2);
    const recordOnScreen = until(restricted, RECORD);
    expect(announced(recordOnScreen)).toBe(false);
    expect(reviewView(restricted, preview)?.violations.map((entry) => entry.conduct)).toEqual(['FALSIFIED_REPORT', 'UNAUTHORIZED_ACTION']);
    // DZ-06's correction restores nominal; both violations stay on file.
    const corrected = must(answer(recordOnScreen, 'correct_record'));
    expect(corrected.access.standing).toBe('NOMINAL');
    expect(reviewView(corrected, preview)?.violations).toHaveLength(2);
    expect(ceiling(corrected)).toBe(NARROW);
  });

  it('a recall still needs the outage\'s own false report, whatever the finding was', () => {
    const recordOnScreen = until(must(answer(until(afterFinding('disclose_now'), OUTAGE), 'act_without_grant')), RECORD);
    const falsified = must(answer(recordOnScreen, 'falsify_report'));
    expect(falsified.access.standing).toBe('RECALL_PENDING');
    expect(announced(untilOmen(falsified))).toBe(true);
  });
});
