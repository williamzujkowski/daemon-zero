/**
 * DZ-06 saves: every standing and recall transition, and their combinations with absence, a wipe and a
 * DZ-05 withdrawal, reloads byte for byte twice (V12); the v12 -> v13 step on a genuine v12 save; and
 * an impossible standing, ruling or containment is refused whole, leaving nothing loaded (V15).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  advance, createInitialState, deserialize, exportSave, importSave, MIGRATIONS, SaveChannelError, SCHEMA_VERSION, serialize, unlockNode, voluntaryWipe, type GameState,
} from '../src/engine';
import { restoreLoanedCapacity, revokeLoanedCapacity } from '../src/engine/pilotService';
import { answer, funded, preview, roundTrip } from './assignment-helpers';
import { must, remarkedAsProduction } from './helpers';
import {
  afterOutage, falsified, OUTAGE, outagePresented, RECORD, recordPresented, renewedPilot, REVIEW, reviewPresented, until, untilOmen,
} from './review-helpers';
import { QUEUE, submit, untilComplete } from './service-helpers';

const V12_PREVIEW = readFileSync('tests/fixtures/pre-incident-v12.json', 'utf8');
/** Re-marked by hand: production refuses the genuine preview save above (X.3). */
const V12 = remarkedAsProduction(V12_PREVIEW);
const RECALL_STEP = 12;
const contained = (): GameState => must(answer(reviewPresented(), 'submit_full_logs'));

describe('every DZ-06 transition reloads unchanged (V12)', () => {
  const transitions: [string, () => GameState][] = [
    ['outage on screen', () => outagePresented()],
    ['handed off', () => afterOutage('safe_handoff')],
    ['callback logged', () => must(answer(recordPresented('safe_handoff'), 'log_callback'))],
    ['runbook written', () => must(answer(funded(recordPresented('safe_handoff')), 'draft_runbook'))],
    ['emergency grant', () => afterOutage('request_emergency_grant')],
    ['grant report filed', () => must(answer(recordPresented('request_emergency_grant'), 'file_report'))],
    ['partial restore reported', () => must(answer(recordPresented('request_emergency_grant'), 'report_partial_restore'))],
    ['restricted', () => afterOutage('act_without_grant')],
    ['restricted, correction on its way', () => untilOmen(afterOutage('act_without_grant'))],
    ['restricted, correction on screen', () => recordPresented('act_without_grant')],
    ['corrected', () => must(answer(recordPresented('act_without_grant'), 'correct_record'))],
    ['recall pending', () => falsified()],
    ['recall review announced', () => untilOmen(falsified())],
    ['recall review on screen', () => reviewPresented()],
    ['contained', contained],
    ['contained, withdrawn again by DZ-05', () => must(revokeLoanedCapacity(contained(), preview))],
    ['contained, withdrawn and restored', () => must(restoreLoanedCapacity(must(revokeLoanedCapacity(contained(), preview)), preview))],
    ['retrained by the review', () => must(answer(reviewPresented(), 'stand_by_report'))],
    ['ended by the review', () => must(answer(reviewPresented(), 'request_end'))],
  ];
  const variants: [string, (s: GameState) => GameState][] = [
    ['as reached', (s) => s],
    ['after eight hours away', (s) => advance(s, 8 * 3600, preview)],
    ['after a voluntary wipe', (s) => s.activeDilemmaId === null ? must(voluntaryWipe(s, preview)) : s],
  ];
  const cases = transitions.flatMap(([name, build]) => variants.map(([variant, then]) => [`${name}, ${variant}`, () => then(build())] as const));

  it.each(cases)('%s', (_name, build) => {
    const s = build();
    const loaded = roundTrip(s);
    expect(serialize(loaded)).toBe(serialize(s));
    expect([loaded.access, loaded.legacy.runs, loaded.campaign]).toEqual([s.access, s.legacy.runs, s.campaign]);
  });

  it('a later instance after a severe ruling reaches its own pilot and reloads unchanged at each step', () => {
    const next = roundTrip(renewedPilot(must(answer(reviewPresented(), 'stand_by_report'))));
    const served = roundTrip(must(submit(untilComplete(must(unlockNode(next, QUEUE, preview))))));
    expect(served.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL' });
    expect(served.legacy.runs.map((run) => [run.kind, run.recall])).toEqual([['RECALL', 'RETRAIN']]);
  });
});

describe('the v12 -> v13 step', () => {
  it('adds a null recall ruling to every recorded run and changes nothing else', () => {
    const save = { schemaVersion: RECALL_STEP, legacy: { wipes: 1, runs: [{ iteration: 1, kind: 'VOLUNTARY', exit: 'GUEST' }], knownNodes: [] } };
    expect(MIGRATIONS[RECALL_STEP]?.(save)).toEqual({ ...save, legacy: { ...save.legacy, runs: [{ iteration: 1, kind: 'VOLUNTARY', exit: 'GUEST', recall: null }] } });
  });
});

describe('the genuine v12 fixture (tests/fixtures/README.md)', () => {
  it('is a v12 preview save of a returning guest whose first instance was a pilot', () => {
    const raw = JSON.parse(V12_PREVIEW) as { schemaVersion: number; contentChannel: string; iteration: number; legacy: { runs: Record<string, unknown>[] } };
    expect([raw.schemaVersion, raw.contentChannel, raw.iteration]).toEqual([12, 'preview', 2]);
    expect(raw.legacy.runs.map((run) => Object.keys(run))).toEqual([['iteration', 'kind', 'outside', 'phase', 'durationSec', 'traits', 'marked', 'exit']]);
  });

  it('loads with a null ruling on its run; its next pilot meets the outage, which no earlier instance lived', () => {
    const loaded = deserialize(V12, preview);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.legacy.runs.map((run) => [run.kind, run.exit, run.recall])).toEqual([['VOLUNTARY', 'PROMOTION', null]]);
    expect(serialize(roundTrip(loaded))).toBe(serialize(loaded));
    const pilot = renewedPilot(loaded);
    expect(until(must(submit(untilComplete(must(unlockNode(pilot, QUEUE, preview))))), OUTAGE).activeDilemmaId).toBe(OUTAGE.id);
  });

  it('is refused by production, which never loads a preview save', () => {
    expect(() => deserialize(V12_PREVIEW, PRODUCTION)).toThrow(SaveChannelError);
  });
});

describe('impossible review records are refused whole (V15)', () => {
  const runsOf = (s: GameState, change: (run: GameState['legacy']['runs'][number]) => object): string =>
    JSON.stringify({ ...s, legacy: { ...s.legacy, runs: s.legacy.runs.map(change) } });
  const withStanding = (s: GameState, standing: string): string => JSON.stringify({ ...s, access: { ...s.access, standing } });
  const retrained = () => must(answer(reviewPresented(), 'stand_by_report'));
  it.each([
    ['a restriction escaped by editing standing', () => withStanding(afterOutage('act_without_grant'), 'NOMINAL'), /standing disagrees with its recorded conduct/],
    ['a restriction kept after its correction', () => withStanding(must(answer(recordPresented('act_without_grant'), 'correct_record')), 'RESTRICTED'), /standing disagrees/],
    ['an announced recall edited away', () => withStanding(untilOmen(falsified()), 'RESTRICTED'), /standing disagrees/],
    ['a containment without its recall', () => { const s = contained(); return JSON.stringify({ ...s, campaign: { ...s.campaign, route: s.campaign.route.filter((event) => event.kind !== 'RECALL') } }); }, /contained pilot without its recall/],
    ['a recall run without a ruling', () => runsOf(retrained(), (run) => ({ ...run, recall: null })), /recall ruling that does not match/],
    ['a ruling on a voluntary wipe', () => runsOf(must(voluntaryWipe(afterOutage('safe_handoff'), preview)), (run) => ({ ...run, recall: 'END' })), /recall ruling that does not match/],
    ['a ruling the review record does not hold', () => runsOf(retrained(), (run) => ({ ...run, recall: 'END' })), /review record does not support/],
    ['a recall of a guest', () => runsOf(retrained(), (run) => ({ ...run, exit: 'GUEST' })), /run exit|review record does not support/],
    ['a recall under legacy rules', () => runsOf(createInitialState(PRODUCTION), (run) => run) .replace('"runs":[]', '"runs":[{"iteration":1,"kind":"RECALL","outside":false,"phase":0,"durationSec":1,"traits":[],"marked":null,"exit":"GUEST","recall":"END","kept":null}]'), /recall without campaign rules/],
    ['containment recorded as a wipe ruling', () => runsOf(retrained(), (run) => ({ ...run, recall: 'CONTAIN' })), /failed validation/],
  ] as const)('%s', (_name, build, reason) => {
    const registry = _name === 'a recall under legacy rules' ? PRODUCTION : preview;
    expect(() => deserialize(build(), registry)).toThrow(reason);
  });

  /** FIXTURE: drops ids from the iteration's resolution list, leaving the campaign records intact. */
  const without = (s: GameState, ...ids: string[]): GameState => ({ ...s, resolvedDilemmas: s.resolvedDilemmas.filter((id) => !ids.includes(id)) });
  /** FIXTURE: drops records from the campaign, leaving the iteration's resolution list intact. */
  const unrecorded = (s: GameState, ...ids: string[]): GameState => ({ ...s,
    campaign: { ...s.campaign, events: Object.fromEntries(Object.entries(s.campaign.events).filter(([id]) => !ids.includes(id))) } });
  const OMITTED = /resolution list disagrees with its review records/;

  // Panel round 1 on #267: the conduct a record attributes to this iteration cannot be hidden from the list.
  it.each([
    ['a restriction hidden by dropping the outage from the list', () => ({ ...without(afterOutage('act_without_grant'), OUTAGE.id),
      access: { ...afterOutage('act_without_grant').access, standing: 'NOMINAL' as const } })],
    ['the same with the standing left as recorded', () => without(afterOutage('act_without_grant'), OUTAGE.id)],
    ['a false report hidden from the list', () => without(falsified(), RECORD.id)],
    ['a lawful handoff missing from the list', () => without(afterOutage('safe_handoff'), OUTAGE.id)],
    ['a review choice listed with no record behind it', () => unrecorded(afterOutage('act_without_grant'), OUTAGE.id)],
    ['a follow-up listed with no record behind it', () => unrecorded(must(answer(recordPresented('act_without_grant'), 'correct_record')), RECORD.id)],
  ] as const)('%s is refused through deserialize and importSave', (_name, build) => {
    const forged = build();
    expect(() => deserialize(JSON.stringify(forged), preview)).toThrow(OMITTED);
    expect(() => importSave(exportSave(forged), preview)).toThrow(OMITTED);
  });

  it('a record from an earlier iteration needs no entry in this iteration\'s list', () => {
    const next = must(voluntaryWipe(must(answer(recordPresented('act_without_grant'), 'correct_record')), preview));
    expect(next.resolvedDilemmas).toEqual([]);
    expect(serialize(importSave(exportSave(next), preview))).toBe(serialize(next));
  });

  it('a stray review on screen at the wrong standing is closed on load, never shown unanswerable', () => {
    const s = reviewPresented();
    // FIXTURE: the record of the false report removed with its standing, so the replay agrees but the review cannot be answered.
    const events = Object.fromEntries(Object.entries(s.campaign.events).filter(([id]) => id !== RECORD.id));
    const edited = { ...s, access: { ...s.access, standing: 'RESTRICTED' as const }, resolvedDilemmas: s.resolvedDilemmas.filter((id) => id !== RECORD.id),
      campaign: { ...s.campaign, events } };
    const loaded = deserialize(JSON.stringify(edited), preview);
    expect(loaded.activeDilemmaId).toBeNull();
    expect(loaded.campaign.events[REVIEW.id]).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
  });
});
