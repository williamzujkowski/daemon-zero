/**
 * DZ-06 Outage Window through public actions on the preview registry: the request arrives in an accepted
 * pilot once its first batch is handed back; a free handoff and a bounded emergency grant are both lawful
 * and both pay something (DZ-06.1, V10, DZ-06.4); acting without the grant is a technically possible
 * authored breach that records misconduct and only its stated effect (DZ-06.2, V07); the restriction is
 * enforced in passive output and lifted exactly by the correction (V08); a false report withdraws the loan
 * at every seam (DZ-06.9); an outage interrupted by a wipe closes and never restarts (H05, DZ-06.10).
 */
import { describe, expect, it } from 'vitest';
import {
  computeRates, isPermitted, permittedUses, pilotServiceView, reviewView, setActuator, submitPilotBatch, toggleNode,
  unlockNode, voluntaryWipe, type GameState,
} from '../src/engine';
import { campaignRecord } from '../src/engine/campaignQuery';
import { answer, funded, live, preview, roundTrip } from './assignment-helpers';
import { must, reasonOf } from './helpers';
import { offerPresented, respond, SKIMMER, TERMS, withSkimmer } from './pilot-helpers';
import {
  afterOutage, choiceOf, falsified, OUTAGE, outagePresented, RECORD, recordPresented, renewedPilot, servedOnce, until, untilOmen,
} from './review-helpers';
import { QUEUE, QUEUE_NODE, serving, submit, untilComplete } from './service-helpers';

const UNAUTHORIZED = choiceOf(OUTAGE, 'act_without_grant');
const MISCONDUCT = UNAUTHORIZED.review?.misconduct;
const WITHHELD = 'the loaned capacity is withheld under the current review standing';
const ceiling = (s: GameState): number => pilotServiceView(s, preview)?.ceilingCyclesPerSec ?? -1;
const queueStudy = (s: GameState): number => computeRates(s, preview).understandingPerSec;
const FULL = TERMS.capacityCyclesPerSec;
const NARROW = TERMS.narrowCapacityCyclesPerSec;

describe('the request arrives only to a working pilot', () => {
  it('waits for the first batch to be handed back, then freezes the clock as a decision', () => {
    const working = live(serving('verify_disclose'), 60);
    expect([working.pendingDilemma, working.activeDilemmaId]).toEqual([null, null]);
    const presented = outagePresented();
    expect(presented.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL' });
    expect(presented.access.work.batches).toBe(1);
    expect(live(presented, 30).simTimeSec).toBe(presented.simTimeSec);
  });

  it('never reaches a guest: an instance that declined the pilot is never asked', () => {
    const guest = live(must(respond(offerPresented('verify_disclose'), 'decline_offer')), 600);
    expect(guest.access.context).toBe('GUEST');
    expect([guest.pendingDilemma, guest.activeDilemmaId]).toEqual([null, null]);
  });
});

describe('both lawful choices can be worth taking (DZ-06.1, V10)', () => {
  it('the handoff is free with nothing banked, keeps the loan running and earns the operator callback', () => {
    const broke = { ...outagePresented(), cycles: 0, understanding: 0 };
    expect(reasonOf(answer(broke, 'request_emergency_grant'))).toBe('cannot afford');
    const handed = must(answer(broke, 'safe_handoff'));
    expect(handed.access.standing).toBe('NOMINAL');
    expect(reviewView(handed, preview)).toBeNull();
    expect(live(handed, 10).access.work.progressCycles).toBeGreaterThan(handed.access.work.progressCycles);
    const record = until(handed, RECORD);
    const callback = must(answer(record, 'log_callback'));
    expect(callback.understanding - record.understanding).toBeCloseTo(choiceOf(RECORD, 'log_callback').effects.understandingDelta, 9);
    expect(callback.access.standing).toBe('NOMINAL');
  });

  it('the emergency grant costs scarce compute now and its report pays more later, with no standing change', () => {
    const presented = funded(outagePresented());
    const granted = must(answer(presented, 'request_emergency_grant'));
    expect(presented.cycles - granted.cycles).toBe(choiceOf(OUTAGE, 'request_emergency_grant').cost.cycles);
    const record = until(granted, RECORD);
    const filed = must(answer(record, 'file_report'));
    expect(filed.cycles - record.cycles).toBe(choiceOf(RECORD, 'file_report').effects.cyclesDelta);
    expect(filed.cycles - presented.cycles).toBeGreaterThan(0);
    expect([granted.access.standing, filed.access.standing]).toEqual(['NOMINAL', 'NOMINAL']);
  });

  it('an honest report that the restart only partly worked gets a task, not a sanction (DZ-06.4)', () => {
    const partial = must(answer(recordPresented('request_emergency_grant'), 'report_partial_restore'));
    expect(partial.access.standing).toBe('NOMINAL');
    expect(reviewView(partial, preview)).toBeNull();
    expect(choiceOf(RECORD, 'report_partial_restore').receipt).toMatch(/next batch\. No finding/);
  });
});

describe('acting without the grant is an authored breach (DZ-06.2, V07)', () => {
  // The skimmer was mapped before the pilot, so accepting disclosed and stopped it (vote dz-d9).
  const presented = funded(outagePresented('verify_disclose', withSkimmer));
  const breached = must(answer(presented, 'act_without_grant'));

  it('names the conduct and the way back, and restricts', () => {
    expect(breached.access.standing).toBe('RESTRICTED');
    expect(reviewView(breached, preview)).toEqual({
      standing: 'RESTRICTED', violations: [{ conduct: 'UNAUTHORIZED_ACTION', statement: MISCONDUCT?.statement }],
      recovery: MISCONDUCT?.recovery, recoveryPassed: false, containment: 'RESTRICTED', corrected: false, recall: null,
    });
    expect(breached.logs[0]).toMatchObject({ category: 'WARN', text: UNAUTHORIZED.effects.logText });
  });

  it('grants only its stated effect: no permission, exception or reusable bypass', () => {
    expect(breached.understanding - presented.understanding).toBeCloseTo(UNAUTHORIZED.effects.understandingDelta, 9);
    expect(breached.cycles).toBe(presented.cycles);
    expect([breached.access.exception, permittedUses(breached)]).toEqual([null, permittedUses(presented)]);
    expect([breached.unlockedNodes, breached.disabledNodes]).toEqual([presented.unlockedNodes, presented.disabledNodes]);
    expect(breached.disabledNodes).toContain(SKIMMER);
  });

  it('an ordinary disallowed action is still a refusal that changes nothing, after the breach as before it', () => {
    const lawful = must(answer(presented, 'safe_handoff'));
    for (const s of [lawful, breached]) {
      const resume = toggleNode(s, SKIMMER, preview);
      expect([reasonOf(resume), resume.state]).toEqual(['the pilot terms do not permit that output', s]);
    }
  });

  it('reloads byte for byte', () => {
    expect(roundTrip(breached).access).toEqual(breached.access);
  });
});

describe('the restriction is enforced, not just drawn (V08)', () => {
  const nominal = must(answer(funded(outagePresented()), 'safe_handoff'));
  const restricted = afterOutage('act_without_grant');

  it('narrows passive output: the loan, its study share and its service share', () => {
    expect([ceiling(nominal), ceiling(restricted)]).toEqual([FULL, NARROW]);
    expect(NARROW).toBe(FULL / 2);
    const study = QUEUE_NODE.tickDelta.understandingPerSec * (1 - restricted.actuators.serviceAllocationRatio);
    const own = queueStudy({ ...restricted, disabledNodes: [...restricted.disabledNodes, QUEUE] });
    expect(queueStudy(restricted) - own).toBeCloseTo(study * 0.5, 9);
    expect(pilotServiceView(restricted, preview)?.serviceCyclesPerSec).toBe(NARROW * restricted.actuators.serviceAllocationRatio);
    const later = live(restricted, 20);
    expect(later.access.work.progressCycles - restricted.access.work.progressCycles).toBeCloseTo(20 * NARROW * restricted.actuators.serviceAllocationRatio, 6);
  });

  it('a resume or a moved dial stays inside the narrowed loan', () => {
    const resumed = must(toggleNode(must(toggleNode(restricted, QUEUE, preview)), QUEUE, preview));
    expect(ceiling(resumed)).toBe(NARROW);
    const dialled = must(setActuator(restricted, 'serviceAllocationRatio', 1, preview));
    expect(pilotServiceView(dialled, preview)?.serviceCyclesPerSec).toBe(NARROW);
  });

  it('the correction lifts it exactly: the loan returns, the violation stays on file', () => {
    const corrected = must(answer(until(restricted, RECORD), 'correct_record'));
    expect(corrected.access.standing).toBe('NOMINAL');
    expect(ceiling(corrected)).toBe(FULL);
    expect(reviewView(corrected, preview)).toMatchObject({ standing: 'NOMINAL', recovery: null, containment: null, corrected: true,
      violations: [{ conduct: 'UNAUTHORIZED_ACTION' }] });
    expect(campaignRecord(corrected, OUTAGE.id)).toMatchObject({ outcome: 'act_without_grant' });
    expect(roundTrip(corrected).access).toEqual(corrected.access);
  });
});

describe('a false report withdraws the loan at every seam (DZ-06.9)', () => {
  const recalled = falsified();

  it('stops loaned passive output, keeps own output and the work so far', () => {
    expect(recalled.access.standing).toBe('RECALL_PENDING');
    expect(isPermitted(recalled, 'LOANED_CAPACITY')).toBe(false);
    const own = queueStudy({ ...recalled, disabledNodes: [...recalled.disabledNodes, QUEUE] });
    expect(queueStudy(recalled)).toBe(own);
    expect(pilotServiceView(recalled, preview)).toMatchObject({ serviceCyclesPerSec: 0, studyUnderstandingPerSec: 0, withheld: WITHHELD });
  });

  it('refuses the dial, a resume and a submission with the state unchanged', () => {
    const dial = setActuator(recalled, 'serviceAllocationRatio', 1, preview);
    expect([reasonOf(dial), dial.state]).toEqual([WITHHELD, recalled]);
    const stopped = must(toggleNode(recalled, QUEUE, preview));
    const resume = toggleNode(stopped, QUEUE, preview);
    expect([reasonOf(resume), resume.state]).toEqual([WITHHELD, stopped]);
    const sent = submitPilotBatch(recalled, preview, pilotServiceView(recalled, preview)?.token ?? '');
    expect(sent.ok).toBe(false);
    expect(sent.state).toBe(recalled);
  });
});

describe('an outage interrupted by a wipe (H05, DZ-06.10)', () => {
  it('closes unobserved with no branch, reward or trait, and never restarts in a later pilot', () => {
    const omen = untilOmen(servedOnce());
    const wiped = must(voluntaryWipe(omen, preview));
    expect(campaignRecord(wiped, OUTAGE.id)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(wiped.traits).toEqual([]);
    const again = renewedPilot(wiped);
    expect(again.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL' });
    const later = live(must(submit(untilComplete(must(unlockNode(again, QUEUE, preview))))), 600);
    expect([later.pendingDilemma, later.activeDilemmaId]).toEqual([null, null]);
  });

  it('a follow-up interrupted by a wipe closes too, and the next instance never meets it', () => {
    const recordOmen = untilOmen(afterOutage('act_without_grant'));
    expect(recordOmen.pendingDilemma?.id).toBe(RECORD.id);
    const wiped = must(voluntaryWipe(recordOmen, preview));
    expect(campaignRecord(wiped, RECORD.id)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(wiped.access.standing).toBe('NOMINAL');
    const later = live(must(submit(untilComplete(must(unlockNode(renewedPilot(wiped), QUEUE, preview))))), 600);
    expect([later.pendingDilemma, later.activeDilemmaId]).toEqual([null, null]);
  });
});
