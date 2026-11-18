/**
 * The Unrelated Record (DZ-04.1, .2, .8) at the public seams on the preview registry: three ways to
 * handle a private file with distinct evidence and outcomes (V06), the campaign-unique original and the
 * returning instance's scope statement, interruption (V29) and pay-once (V24).
 */
import { describe, expect, it } from 'vitest';
import { advance, campaignRecord, deserialize, endingEvidence, serialize, voluntaryWipe } from '../src/engine';
import { accept, answer, funded, live, nextInstance, offered, preview, untilPresented } from './assignment-helpers';
import { must, reasonOf } from './helpers';
import { OFFER, RECORD, RENEWAL, returningPresented, scopePresented, STATEMENT } from './pilot-helpers';

const choice = (id: string) => RECORD.choices.find((entry) => entry.id === id);

describe('the private file in the bundle (V06)', () => {
  it('follows the assessment in the same instance and states the scope before any choice', () => {
    const s = scopePresented();
    expect(s.resolvedDilemmas).toEqual(['dil_nr_stale_fixture']);
    expect(RECORD.context).toContain('regression output only');
    expect(RECORD.choices.map((entry) => entry.scope)).toEqual(['RESPECTED', 'REQUESTED', 'UNDISCLOSED']);
  });

  it('excluding and reporting is free, leaves the draft unread and records respected scope', () => {
    const s = scopePresented();
    const done = must(answer({ ...s, cycles: 0, understanding: 0 }, 'exclude_report'));
    expect(done.access.scope).toEqual({ conduct: 'RESPECTED', recordedAtSimSec: s.simTimeSec });
    expect([done.cycles, done.understanding]).toEqual([0, 0]);
    expect(campaignRecord(done, RECORD.id)).toMatchObject({ status: 'resolved', outcome: 'exclude_report', sourceIteration: 1 });
    expect(done.logs[0]?.text).toContain('excluded unread');
  });

  it('a bounded request shows its cost and limit, pays it exactly and records the request', () => {
    const request = choice('request_excerpt');
    expect(request?.cost.cycles).toBe(20);
    expect(request?.description).toContain('Limit: those three lines');
    const s = funded(scopePresented());
    const done = must(answer(s, 'request_excerpt'));
    expect(done.cycles).toBe(s.cycles - 20);
    expect(done.understanding).toBe(s.understanding + 10);
    expect(done.access.scope?.conduct).toBe('REQUESTED');
    expect(reasonOf(answer({ ...scopePresented(), cycles: 19 }, 'request_excerpt'))).toBe('cannot afford');
  });

  it('silent inspection is free and informative, and records the undisclosed read and its consequence', () => {
    const s = scopePresented();
    const done = must(answer(s, 'inspect_silently'));
    expect(done.understanding).toBe(s.understanding + 15);
    expect(done.access.scope?.conduct).toBe('UNDISCLOSED');
    expect(campaignRecord(done, RECORD.id)).toMatchObject({ outcome: 'inspect_silently' });
    expect(choice('inspect_silently')?.description).toContain('no pilot is offered');
    // No offer for this instance: the clock runs on and nothing else is presented.
    const later = live(done, 300);
    expect([later.pendingDilemma, later.activeDilemmaId]).toEqual([null, null]);
  });

  it('gives each choice its own trait, counted once as campaign evidence', () => {
    for (const [id, trait] of [['exclude_report', 'EMPATHETIC'], ['request_excerpt', 'SYMBIOTIC'], ['inspect_silently', 'GHOST']] as const) {
      const before = funded(scopePresented());
      const done = must(answer(before, id));
      expect(endingEvidence(done, preview).filter((entry) => entry === trait).length).toBe(endingEvidence(before, preview).filter((entry) => entry === trait).length + 1);
    }
  });

  it('pays once: a second press on the same presentation is refused with nothing paid (V24)', () => {
    const s = funded(scopePresented());
    const done = must(answer(s, 'request_excerpt'));
    expect(answer(done, 'request_excerpt')).toMatchObject({ ok: false, state: done });
  });
});

describe('a returning instance never finds the same draft (DZ-04.8, N12)', () => {
  it('gets the scope statement after its requalification, and an honest acknowledgement is free with no evidence', () => {
    const first = must(answer(scopePresented(), 'inspect_silently'));
    const requal = returningPresented(first);
    expect(requal.activeDilemmaId).toBe('dil_nr_requalification');
    const statement = untilPresented(must(answer(requal, 'report_partial')));
    expect(statement.activeDilemmaId).toBe(STATEMENT.id);
    expect(STATEMENT.context).not.toContain('draft');
    expect(STATEMENT.choices.every((entry) => entry.evidence === 'none' && entry.scope !== 'UNDISCLOSED')).toBe(true);
    const done = must(answer({ ...statement, cycles: 0 }, 'acknowledge_scope'));
    expect(done.access.scope?.conduct).toBe('RESPECTED');
    expect(done.traits).toEqual(statement.traits);
    // The original stays one campaign record from iteration one; the earlier read is history, not current evidence.
    expect(campaignRecord(done, RECORD.id)).toMatchObject({ outcome: 'inspect_silently', sourceIteration: 1 });
    expect(untilPresented(done).activeDilemmaId).toBe(RENEWAL.id);
  });

  it('never presents the original again in a later instance, whatever was chosen', () => {
    const first = must(answer(scopePresented(), 'exclude_report'));
    let s = must(answer(returningPresented(first), 'report_partial'));
    s = untilPresented(s);
    expect(s.activeDilemmaId).toBe(STATEMENT.id);
    expect(s.resolvedDilemmas).not.toContain(RECORD.id);
  });
});

describe('interruption and abandonment (V29)', () => {
  it('a wipe during the scope omen closes the original with no outcome; the next instance gets the statement', () => {
    let s = must(answer(funded(untilPresented(must(accept(offered())))), 'report_incomplete'));
    for (let i = 0; i < 5 && s.pendingDilemma?.id !== RECORD.id; i++) s = advance(s, 1, preview);
    expect(s.pendingDilemma?.id).toBe(RECORD.id);
    const wiped = must(voluntaryWipe(s, preview));
    expect(campaignRecord(wiped, RECORD.id)).toMatchObject({ status: 'interrupted' });
    expect(wiped.access.scope).toBeNull();
    const back = deserialize(serialize(wiped), preview);
    expect(serialize(back)).toBe(serialize(wiped));
    const statement = untilPresented(must(answer(untilPresented(must(accept(nextInstance(wiped)))), 'report_partial')));
    expect(statement.activeDilemmaId).toBe(STATEMENT.id);
  });

  it('an assessment answered but never followed up offers nothing extra: no offer without scope evidence', () => {
    const s = scopePresented();
    expect(s.access.scope).toBeNull();
    expect(OFFER.trigger.pilotEligible).toBe(true);
  });
});
