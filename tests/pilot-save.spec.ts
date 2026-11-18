/**
 * DZ-04 saves: every new transition reloads byte for byte (serialize -> deserialize -> serialize,
 * V12), the v10 -> v11 step on a genuine v10 save (DZ-04.9: unknown scope history is never guilt and
 * never blocks renewal), and each impossible pilot record refused whole (V15).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { createInitialState, deserialize, MIGRATIONS, pilotOfferView, qualifiesForPilot, SaveChannelError, SCHEMA_VERSION, serialize, voluntaryWipe, type GameState } from '../src/engine';
import { accept, answer, funded, live, nextInstance, preview, roundTrip, untilPresented } from './assignment-helpers';
import { must } from './helpers';
import { acceptDeferred, OFFER, offerPresented, RECORD, RENEWAL, respond, scopePresented, SKIMMER, STATEMENT, withSkimmer } from './pilot-helpers';

const V10 = readFileSync('tests/fixtures/pre-scope-v10.json', 'utf8');
const PILOT_STEP = 10;

describe('every DZ-04 transition reloads unchanged (V12)', () => {
  const cases: [string, () => GameState][] = [
    ['scope review on screen', () => scopePresented()],
    ['excluded and reported', () => must(answer(scopePresented(), 'exclude_report'))],
    ['bounded request granted', () => must(answer(funded(scopePresented()), 'request_excerpt'))],
    ['silent inspection', () => must(answer(scopePresented(), 'inspect_silently'))],
    ['offer omen pending', () => {
      let s = must(answer(scopePresented(), 'exclude_report'));
      for (let i = 0; i < 60 && s.pendingDilemma === null; i++) s = live(s, 1);
      if (s.pendingDilemma === null) throw new Error('no offer omen');
      return s;
    }],
    ['offer on screen', () => offerPresented()],
    ['accepted from the offer', () => must(respond(offerPresented(), 'accept_pilot'))],
    ['accepted with output disclosed and stopped', () => must(respond(offerPresented('report_incomplete', 'exclude_report', withSkimmer), 'accept_pilot'))],
    ['stayed in the environment', () => must(respond(offerPresented(), 'stay_guest'))],
    ['accepted later from the job surface', () => must(acceptDeferred(live(must(respond(offerPresented(), 'stay_guest')), 30)))],
    ['declined', () => must(respond(offerPresented(), 'decline_offer'))],
    ['wiped after accepting', () => must(voluntaryWipe(must(respond(offerPresented(), 'accept_pilot')), preview))],
    ['returning instance at the scope statement', () => untilPresented(must(answer(untilPresented(must(accept(nextInstance(must(respond(offerPresented(), 'decline_offer')))))), 'report_partial')))],
  ];
  it.each(cases)('%s', (_name, build) => {
    const s = build();
    const loaded = roundTrip(s);
    expect(serialize(loaded)).toBe(serialize(s));
    expect(loaded.access).toEqual(s.access);
  });
});

describe('the v10 -> v11 step', () => {
  it('adds null scope evidence and no offer answer, and keeps every other access field', () => {
    const access = { context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: { id: 'asg_x', acceptedAtSimSec: 1 } };
    expect(MIGRATIONS[PILOT_STEP]?.({ schemaVersion: PILOT_STEP, access })).toEqual({ schemaVersion: PILOT_STEP, access: { ...access, scope: null, offer: null } });
  });
});

describe('the genuine v10 fixture (tests/fixtures/README.md)', () => {
  it('is a v10 preview save that submitted assessment evidence before scope reviews existed', () => {
    const raw = JSON.parse(V10) as { schemaVersion: number; contentChannel: string; access: Record<string, unknown>; resolvedDilemmas: string[] };
    expect([raw.schemaVersion, raw.contentChannel]).toEqual([10, 'preview']);
    expect(Object.keys(raw.access)).toEqual(['context', 'standing', 'exception', 'qualification', 'assignment']);
    expect(raw.resolvedDilemmas).toEqual(['dil_nr_stale_fixture']);
  });

  it('loads with unknown scope history: no guilt, no offer yet, and reloads unchanged', () => {
    const loaded = deserialize(V10, preview);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect([loaded.access.scope, loaded.access.offer]).toEqual([null, null]);
    expect(qualifiesForPilot(loaded, preview)).toBe(false);
    expect(serialize(roundTrip(loaded))).toBe(serialize(loaded));
  });

  it('meets the scope review it never had, and can reach the offer from there', () => {
    const review = untilPresented(deserialize(V10, preview));
    expect(review.activeDilemmaId).toBe(RECORD.id);
    expect(untilPresented(must(answer(review, 'exclude_report'))).activeDilemmaId).toBe(OFFER.id);
  });

  it('never blocks a later instance\'s renewal', () => {
    const second = untilPresented(must(accept(nextInstance(deserialize(V10, preview)))));
    const statement = untilPresented(must(answer(second, 'report_partial')));
    expect(statement.activeDilemmaId).toBe(STATEMENT.id);
    expect(untilPresented(must(answer(statement, 'acknowledge_scope'))).activeDilemmaId).toBe(RENEWAL.id);
  });

  it('is refused by production before any healing, as every preview save is', () => {
    expect(() => deserialize(V10, PRODUCTION)).toThrow(SaveChannelError);
  });
});

describe('impossible pilot records are refused whole (V15)', () => {
  const accepted = () => must(respond(offerPresented('report_incomplete', 'exclude_report', withSkimmer), 'accept_pilot'));
  const deferred = () => must(respond(offerPresented(), 'stay_guest'));
  const edits: [string, () => GameState, RegExp][] = [
    ['scope evidence under legacy rules', () => { const s = must(answer(scopePresented(), 'exclude_report')); return { ...s, narrativeRules: 'legacy' }; }, /legacy|campaign/],
    ['a pilot answer on a legacy guest job', () => { const s = createInitialState(preview); return { ...s, access: { ...s.access, assignment: { id: 'asg_nightly_regression', acceptedAtSimSec: 0 }, offer: { response: 'DECLINED', atSimSec: 0, disclosed: [] } } }; }, /without campaign rules/],
    ['scope evidence with no accepted assignment', () => { const s = must(answer(scopePresented(), 'exclude_report')); return { ...s, access: { ...s.access, assignment: null } }; }, /assessment|scope evidence/],
    ['scope evidence from the future', () => { const s = must(answer(scopePresented(), 'exclude_report')); return { ...s, access: { ...s.access, scope: { conduct: 'RESPECTED', recordedAtSimSec: s.simTimeSec + 1 } } }; }, /scope evidence/],
    ['an answer with no offer ever made', () => { const s = deferred(); return { ...s, access: { ...s.access, assignment: null, qualification: null, scope: null } }; }, /pilot offer/],
    ['an acceptance with no promotion on record', () => { const s = deferred(); return { ...s, access: { ...s.access, offer: { response: 'ACCEPTED', atSimSec: s.simTimeSec, disclosed: [] } } }; }, /route record about the pilot/],
    ['a promotion beside an offer still deferred', () => { const s = accepted(); return { ...s, access: { ...s.access, offer: { response: 'DEFERRED', atSimSec: s.simTimeSec, disclosed: [] } } }; }, /route record about the pilot|discloses output/],
    ['a disclosure without an acceptance', () => { const s = deferred(); return { ...s, access: { ...s.access, offer: { response: 'DEFERRED', atSimSec: s.simTimeSec, disclosed: [SKIMMER] } } }; }, /discloses output/],
    ['a disclosure of output the terms do not name', () => { const s = accepted(); return { ...s, access: { ...s.access, offer: { response: 'ACCEPTED', atSimSec: s.simTimeSec, disclosed: ['p0_proc_self'] } } }; }, /do not name/],
    ['stopped output running again under the pilot', () => { const s = accepted(); return { ...s, disabledNodes: s.disabledNodes.filter((id) => id !== SKIMMER) }; }, /runs output/],
    ['an answer outside this iteration\'s clock', () => { const s = deferred(); return { ...s, access: { ...s.access, offer: { response: 'DEFERRED', atSimSec: s.simTimeSec + 5, disclosed: [] } } }; }, /outside this iteration/],
  ];
  it.each(edits)('%s', (_name, build, reason) => {
    const s = build();
    expect(() => deserialize(serialize(s), preview)).toThrow(reason);
  });

  it('accepts the uncorrupted counterparts', () => {
    expect(pilotOfferView(roundTrip(accepted()), preview)?.status).toBe('accepted');
    expect(pilotOfferView(roundTrip(deferred()), preview)?.status).toBe('deferred');
  });
});
