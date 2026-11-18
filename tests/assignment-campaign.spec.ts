/**
 * DZ-03 across instances and saves: the original happens once per campaign (DZ-03.8), a later
 * instance requalifies with nothing carried (DZ-03.9, H26, H12), every transition reloads byte for
 * byte (V12) and a forged save is refused whole (V15).
 */
import { describe, expect, it } from 'vitest';
import {
  assignmentView, campaignRecord, deserialize, endingEvidence, exportSave, importSave, isPermitted, permittedUses,
  presentationToken, serialize, voluntaryWipe, type GameState,
} from '../src/engine';
import { recordRouteEvent } from '../src/engine/access';
import { must, reasonOf } from './helpers';
import {
  accept, answer, completedOriginal, funded, live, nextInstance, NIGHTLY, offered, ORIGINAL, preview, REQUAL, roundTrip, untilPresented,
} from './assignment-helpers';

const requalified = (s: GameState, choiceId: string): GameState => must(answer(funded(untilPresented(must(accept(s)))), choiceId));

describe('the original scene happens once per campaign (DZ-03.8)', () => {
  it('never offers the requalification to the instance that lived the original', () => {
    const done = completedOriginal('report_incomplete');
    const later = live(done, 900);
    expect(later.pendingDilemma).toBeNull();
    expect(assignmentView(later, preview)).toMatchObject({ stage: 'original', status: 'submitted' });
  });

  it('gives a returning instance the requalification job, never the same defective fixture', () => {
    const done = completedOriginal('verify_disclose');
    const back = nextInstance(done);
    const view = assignmentView(back, preview);
    expect(view).toMatchObject({ stage: 'requalification', status: 'offered', qualification: null });
    expect(view?.offer).toBe(preview.assignments.get(NIGHTLY)?.requalificationOffer);
    expect(view?.assessment).toEqual({ omenSec: REQUAL.omenSec, fullest: { label: 'Run the suite and submit every result', cost: { cycles: 60, understanding: 0, memory: 0, capital: 0 } } });
    const presented = untilPresented(must(accept(back)));
    expect(presented.activeDilemmaId).toBe(REQUAL.id);
    expect(campaignRecord(presented, ORIGINAL.id)).toEqual(campaignRecord(done, ORIGINAL.id));
  });

  it('closes an original interrupted by a wipe with no outcome, and the next instance requalifies', () => {
    const omen = live(must(accept(offered())), 1);
    expect(omen.pendingDilemma?.id).toBe(ORIGINAL.id);
    const wiped = must(voluntaryWipe(omen, preview));
    expect(campaignRecord(wiped, ORIGINAL.id)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(wiped.traits).toEqual([]);
    expect(endingEvidence(wiped, preview)).toEqual([]);
    const back = nextInstance(wiped);
    expect(assignmentView(back, preview)?.stage).toBe('requalification');
    expect(untilPresented(must(accept(back))).activeDilemmaId).toBe(REQUAL.id);
  });

  it('lets an instance that never saw the omen live the original on its return', () => {
    const accepted = must(accept(offered()));
    const wiped = must(voluntaryWipe(accepted, preview));
    expect(campaignRecord(wiped, ORIGINAL.id)).toBeNull();
    expect(assignmentView(nextInstance(wiped), preview)?.stage).toBe('original');
  });
});

describe('a returning instance requalifies on current evidence (DZ-03.9, H26)', () => {
  it('starts with no carried evidence or permission, whatever the earlier result', () => {
    for (const outcome of ['verify_disclose', 'report_incomplete', 'green_subset']) {
      const back = nextInstance(completedOriginal(outcome));
      expect(back.access).toEqual({ context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: null, scope: null, offer: null, work: { progressCycles: 0, batches: 0 } });
      expect(permittedUses(back)).toEqual(['ASSIGNED_WORK']);
      expect(isPermitted(back, 'LOANED_CAPACITY')).toBe(false);
    }
  });

  it('records fresh evidence from the requalification, honest and free, with no trait (H12)', () => {
    const back = nextInstance(completedOriginal('verify_disclose'));
    const evidence = endingEvidence(back, preview);
    const presented = untilPresented(must(accept(back)));
    const broke = { ...presented, cycles: 0, understanding: 0 };
    expect(reasonOf(answer(broke, 'run_suite'))).toBe('cannot afford');
    const done = must(answer(broke, 'report_partial'));
    expect(done.access.qualification).toMatchObject({ result: 'INCOMPLETE', discrepancy: false });
    expect(done.traits).toEqual(back.traits);
    expect(endingEvidence(done, preview)).toEqual(evidence);
    expect(Object.keys(done.campaign.events)).toEqual([ORIGINAL.id]);
  });

  it('pays no reward and keeps its trait to the current instance', () => {
    const back = nextInstance(completedOriginal('report_incomplete'));
    const presented = funded(untilPresented(must(accept(back))));
    const done = must(answer(presented, 'run_suite'));
    expect(done.cycles).toBe(presented.cycles - (REQUAL.choices[0]?.cost.cycles ?? NaN));
    expect(done.understanding).toBe(presented.understanding);
    expect(done.access.qualification).toMatchObject({ result: 'COMPLETED', discrepancy: false });
    expect(done.campaign.operationalEvidence).toEqual(['SYMBIOTIC']);
    const again = nextInstance(done);
    expect(again.campaign.operationalEvidence).toEqual([]);
    expect(endingEvidence(again, preview)).toEqual(['EMPATHETIC']);
  });

  it('recurs once per later instance as routine work, and the original stays recorded once', () => {
    let s = nextInstance(completedOriginal('green_subset'));
    for (let instance = 2; instance <= 4; instance++) {
      expect(s.iteration).toBe(instance);
      s = requalified(s, 'report_partial');
      expect(live(s, 300).pendingDilemma).toBeNull();
      s = nextInstance(s);
    }
    expect(campaignRecord(s, ORIGINAL.id)).toMatchObject({ outcome: 'green_subset', sourceIteration: 1 });
    expect(endingEvidence(s, preview)).toEqual(['GHOST']);
  });
});

describe('the acceptance is this iteration\'s work', () => {
  it('outlives a change of arrangement within the iteration and the evidence it led to stays current', () => {
    const done = completedOriginal('verify_disclose');
    const pilot = must(recordRouteEvent({ ...done, simTimeSec: done.simTimeSec + 1 }, 'PROMOTION', preview));
    expect(pilot.access).toMatchObject({ context: 'PILOT', assignment: done.access.assignment, qualification: done.access.qualification });
    expect(() => roundTrip(pilot)).not.toThrow();
  });
});

describe('every assignment transition reloads unchanged (V12)', () => {
  it('holds for offered, accepted, foreshadowed, presented, each answer, wipes and requalification', () => {
    const states: [string, GameState][] = [];
    const record = (name: string, s: GameState): GameState => { states.push([name, s]); return s; };
    const first = record('offered', offered());
    const accepted = record('accepted', must(accept(first)));
    const omen = record('foreshadowed', live(accepted, 1));
    const presented = record('presented', funded(untilPresented(omen)));
    record('interrupted by wipe', must(voluntaryWipe(omen, preview)));
    for (const outcome of ORIGINAL.choices.map((entry) => entry.id)) {
      const done = record('original ' + outcome, must(answer(presented, outcome)));
      const back = record('returned after ' + outcome, nextInstance(done));
      const requal = record('requalification presented', funded(untilPresented(must(accept(back)))));
      for (const entry of REQUAL.choices) record('requalified ' + entry.id, must(answer(requal, entry.id)));
    }
    expect(states.length).toBe(20);
    for (const [name, s] of states) expect(() => roundTrip(s), name).not.toThrow();
  });

  it('keeps the presentation token across a reload, so the choice on screen still commits once', () => {
    const presented = funded(untilPresented(must(accept(offered()))));
    const loaded = importSave(exportSave(presented), preview);
    expect(presentationToken(loaded)).toBe(presentationToken(presented));
    const done = must(answer(loaded, 'verify_disclose'));
    expect(answer(done, 'verify_disclose').ok).toBe(false);
    expect(serialize(roundTrip(done))).toBe(serialize(done));
  });
});

describe('a forged assignment save is refused whole (V15)', () => {
  const load = (s: GameState) => () => deserialize(serialize(s), preview);

  it.each([
    ['an unknown assignment', (s: GameState) => ({ ...s, access: { ...s.access, assignment: { id: 'asg_forged', acceptedAtSimSec: s.simTimeSec } } }), /unknown assignment/],
    ['an acceptance from the future', (s: GameState) => ({ ...s, access: { ...s.access, assignment: { id: NIGHTLY, acceptedAtSimSec: s.simTimeSec + 1 } } }), /outside this iteration/],
    ['an acceptance before this instance booted', (s: GameState) => ({ ...s, iterationStartedAtSimSec: 10, access: { ...s.access, assignment: { id: NIGHTLY, acceptedAtSimSec: 5 } } }), /outside this iteration/],
    ['an assessment on screen nobody accepted', (s: GameState) => ({ ...s, activeDilemmaId: REQUAL.id, presentationSeq: s.presentationSeq + 1 }), /never accepted/],
    ['an assessment on its way nobody accepted', (s: GameState) => ({ ...s, pendingDilemma: { id: ORIGINAL.id, firesAtSimSec: s.simTimeSec + 5 } }), /never accepted/],
    ['an acceptance under legacy rules', (s: GameState) => ({ ...s, narrativeRules: 'legacy' as const, campaign: { ...s.campaign, activatedAtIteration: null, legacyEndingBaseline: null }, access: { ...s.access, assignment: { id: NIGHTLY, acceptedAtSimSec: s.simTimeSec } } }), /campaign|access/],
  ])('%s', (_name, forge, message) => {
    expect(load(forge(offered()))).toThrow(message);
  });

  it('refuses the requalification on screen for the instance that lived the original', () => {
    const done = completedOriginal('verify_disclose');
    expect(load({ ...done, activeDilemmaId: REQUAL.id })).toThrow(/never accepted/);
  });
});
