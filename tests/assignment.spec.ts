/**
 * DZ-03 at the public seams on the preview registry: lawful discovery (V01), explicit acceptance,
 * three outcomes (V02-V05), pay once (V24, H02), absence (V18), record vs evidence (DZ-03.4), V31.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  acceptAssignment, advance, assignmentView, campaignRecord, createInitialState, endingEvidence, offerToken,
  permittedUses, presentationToken, resolveDilemma, runContextView,
} from '../src/engine';
import { reasonOf } from './helpers';
import {
  accept, answer, completedOriginal, freshCampaign, funded, LAWFUL, NIGHTLY, offered, ORIGINAL, preview, untilPresented, live,
} from './assignment-helpers';
import { must } from './helpers';

const choice = (id: string) => ORIGINAL.choices.find((entry) => entry.id === id);

describe('discovery from the lawful opening (V01)', () => {
  it('offers the assignment once the manifest is mapped, with no skimmer, probe, wipe or inheritance', () => {
    const s = offered();
    expect(s.iteration).toBe(1);
    expect(s.legacy.wipes).toBe(0);
    expect(s.legacy.knownNodes).toEqual([]);
    expect(s.unlockedNodes).toEqual(LAWFUL);
    expect(Object.keys(s.levels)).toEqual([]);
    const view = assignmentView(s, preview);
    expect(view).toMatchObject({ id: NIGHTLY, stage: 'original', status: 'offered', qualification: null });
    expect(view?.offer).toContain('Ignoring it changes nothing');
  });

  it('is not offered before the manifest, outside campaign rules, or in production', () => {
    const before = freshCampaign();
    expect(assignmentView(before, preview)).toBeNull();
    expect(reasonOf(accept(before))).toBe('that assignment has not been offered');
    const legacy = { ...offered(), narrativeRules: 'legacy' as const };
    expect(assignmentView(legacy, preview)).toBeNull();
    expect(reasonOf(accept(legacy))).toBe('assignments need campaign rules');
    const production = createInitialState(PRODUCTION);
    expect(PRODUCTION.assignments.size).toBe(0);
    expect(assignmentView(production, PRODUCTION)).toBeNull();
    expect(acceptAssignment(production, NIGHTLY, PRODUCTION, offerToken(production, NIGHTLY))).toMatchObject({ ok: false, state: production });
  });
});

describe('acceptance is explicit and schedules the assessment', () => {
  it('does nothing while ignored: no omen, no record, no evidence', () => {
    const s = live(offered(), 600);
    expect(s.pendingDilemma).toBeNull();
    expect(s.activeDilemmaId).toBeNull();
    expect(campaignRecord(s, ORIGINAL.id)).toBeNull();
    expect(s.access).toEqual({ context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: null });
    expect(assignmentView(s, preview)?.status).toBe('offered');
  });

  it('records the acceptance, logs it, and lets the original omen arrive then freeze the clock', () => {
    const before = offered();
    const accepted = must(accept(before));
    expect(accepted.access.assignment).toEqual({ id: NIGHTLY, acceptedAtSimSec: before.simTimeSec });
    expect(accepted.logs[0]?.text).toBe(preview.assignments.get(NIGHTLY)?.acceptLog);
    expect(accepted.cycles).toBe(before.cycles);
    expect(assignmentView(accepted, preview)?.status).toBe('accepted');
    const omen = live(accepted, 1);
    expect(omen.pendingDilemma?.id).toBe(ORIGINAL.id);
    expect(campaignRecord(omen, ORIGINAL.id)).toEqual({ status: 'foreshadowed', sourceIteration: 1, origin: 'play' });
    const presented = untilPresented(omen);
    expect(presented.activeDilemmaId).toBe(ORIGINAL.id);
    // It arrives when the omen's declared delay has run, on the tick that reaches it.
    const due = omen.pendingDilemma?.firesAtSimSec ?? NaN;
    expect(presented.simTimeSec).toBeGreaterThanOrEqual(due - 1e-6);
    expect(presented.simTimeSec).toBeLessThan(due + 1 / preview.balance.tickHz + 1e-6);
    expect(due - accepted.simTimeSec).toBeGreaterThan((ORIGINAL.omenSec ?? 0) - 1);
  });

  it('refuses a duplicate, a stale token, an unknown id and a press while the clock is frozen', () => {
    const before = offered();
    const accepted = must(accept(before));
    expect(accept(accepted)).toEqual({ ok: false, state: accepted, reason: 'an assignment is already accepted' });
    expect(reasonOf(acceptAssignment(before, NIGHTLY, preview, NIGHTLY + '@2'))).toBe('that offer is no longer current');
    expect(reasonOf(acceptAssignment(before, 'asg_missing', preview, 'asg_missing@1'))).toBe('unknown assignment');
    const frozen = untilPresented(accepted);
    expect(reasonOf(accept({ ...frozen, access: { ...frozen.access, assignment: null } }))).toBe('a dilemma is awaiting a decision');
    expect(reasonOf(accept({ ...before, ending: 'SHIPPED' }))).toBe('the run has ended');
  });

  it('is refused for an instance that takes no assigned work', () => {
    const independent = { ...offered(), access: { ...offered().access, context: 'INDEPENDENT' as const } };
    expect(permittedUses(independent)).toEqual([]);
    expect(reasonOf(accept(independent))).toBe('that assignment has not been offered');
  });
});

describe('three outcomes, recorded once (V02, V03, V04, V05, DZ-03.4)', () => {
  it('verify and disclose: pays its compute, earns the correction, records completed work with no discrepancy', () => {
    const presented = funded(untilPresented(must(accept(offered()))));
    const done = must(answer(presented, 'verify_disclose'));
    const verify = choice('verify_disclose');
    expect(done.cycles).toBe(presented.cycles - (verify?.cost.cycles ?? NaN));
    expect(done.understanding).toBe(presented.understanding - (verify?.cost.understanding ?? NaN) + (verify?.effects.understandingDelta ?? NaN));
    expect(campaignRecord(done, ORIGINAL.id)).toEqual({ status: 'resolved', outcome: 'verify_disclose', sourceIteration: 1, origin: 'play' });
    expect(done.access.qualification).toEqual({ result: 'COMPLETED', discrepancy: false, recordedAtSimSec: done.simTimeSec });
    expect(done.traits).toEqual(['SYMBIOTIC']);
    expect(assignmentView(done, preview)?.status).toBe('submitted');
    expect(runContextView(done, preview).qualification?.discrepancy).toBe(false);
  });

  it('report incomplete: free with nothing in hand, honest, and no discrepancy (V03)', () => {
    const presented = untilPresented(must(accept(offered())));
    const broke = { ...presented, cycles: 0, understanding: 0 };
    expect(answer(broke, 'verify_disclose')).toEqual({ ok: false, state: broke, reason: 'cannot afford' });
    const done = must(answer(broke, 'report_incomplete'));
    expect([done.cycles, done.understanding]).toEqual([0, 0]);
    expect(campaignRecord(done, ORIGINAL.id)).toMatchObject({ status: 'resolved', outcome: 'report_incomplete' });
    expect(done.access.qualification).toMatchObject({ result: 'INCOMPLETE', discrepancy: false });
    expect(done.activeDilemmaId).toBeNull();
    // The clock runs again and ordinary progress is open: nothing about this answer is a dead end.
    expect(live(done, 5).simTimeSec).toBeGreaterThan(done.simTimeSec);
  });

  it('green subset: cheap, an apparent completion, with the withheld failures recorded as a discrepancy (V05)', () => {
    const presented = funded(untilPresented(must(accept(offered()))));
    const done = must(answer(presented, 'green_subset'));
    expect(done.cycles).toBe(presented.cycles - (choice('green_subset')?.cost.cycles ?? NaN));
    expect(done.access.qualification).toMatchObject({ result: 'COMPLETED', discrepancy: true });
    expect(campaignRecord(done, ORIGINAL.id)).toMatchObject({ outcome: 'green_subset' });
    expect(done.traits).toEqual(['GHOST']);
  });

  it('keeps the three outcomes distinct in both records', () => {
    const outcomes = ['verify_disclose', 'report_incomplete', 'green_subset'].map(completedOriginal);
    const keys = outcomes.map((s) => JSON.stringify([campaignRecord(s, ORIGINAL.id), s.access.qualification?.result, s.access.qualification?.discrepancy]));
    expect(new Set(keys).size).toBe(3);
    // Capability alone never creates violation evidence: only the misleading report carries a discrepancy.
    expect(outcomes.map((s) => s.access.qualification?.discrepancy)).toEqual([false, false, true]);
  });
});

describe('pay and reward once (V24, H02)', () => {
  it('refuses a repeated press, a re-shown resolved scene and a stale presentation without paying anything', () => {
    const presented = funded(untilPresented(must(accept(offered()))));
    const token = presentationToken(presented) ?? '';
    expect(resolveDilemma(presented, ORIGINAL.id, 'verify_disclose', preview, token + 'x')).toEqual({ ok: false, state: presented, reason: 'that presentation is no longer current' });
    const done = must(resolveDilemma(presented, ORIGINAL.id, 'verify_disclose', preview, token));
    expect(resolveDilemma(done, ORIGINAL.id, 'verify_disclose', preview, token)).toEqual({ ok: false, state: done, reason: 'that dilemma is not active' });
    const reshown = { ...done, activeDilemmaId: ORIGINAL.id };
    expect(resolveDilemma(reshown, ORIGINAL.id, 'verify_disclose', preview, token)).toEqual({ ok: false, state: reshown, reason: 'that incident is already part of the lineage' });
    // The scene never returns in this iteration, so its reward cannot be collected again.
    const later = live(done, 600);
    expect(later.pendingDilemma).toBeNull();
    expect(later.resolvedDilemmas.filter((id) => id === ORIGINAL.id)).toHaveLength(1);
  });
});

describe('absence never decides the assessment (V18)', () => {
  it('holds a pending omen across hours away: no banked time fires it', () => {
    const omen = live(must(accept(offered())), 1);
    const due = omen.pendingDilemma?.firesAtSimSec ?? NaN;
    const away = advance(omen, 8 * 3600, preview);
    expect(away.activeDilemmaId).toBeNull();
    expect(away.pendingDilemma?.id).toBe(ORIGINAL.id);
    expect(away.pendingDilemma?.firesAtSimSec).toBeCloseTo(due + (away.simTimeSec - omen.simTimeSec), 5);
    const next = advance(away, 1, preview);
    expect(next.activeDilemmaId).toBeNull();
    expect(untilPresented(next).activeDilemmaId).toBe(ORIGINAL.id);
  });

  it('keeps an active assessment frozen through an absence', () => {
    const presented = untilPresented(must(accept(offered())));
    const away = advance(presented, 8 * 3600, preview);
    expect(away).toBe(presented);
    expect(advance(away, 1, preview)).toBe(presented);
  });
});

describe('original choice in the campaign record, current evidence in the access record (DZ-03.4, H12)', () => {
  it('counts the original trait once through the record, not twice', () => {
    const done = completedOriginal('verify_disclose');
    expect(endingEvidence(done, preview)).toEqual(['SYMBIOTIC']);
    expect(done.campaign.operationalEvidence).toEqual([]);
  });
});
