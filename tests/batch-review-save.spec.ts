/**
 * #274 and #285 saves. No saved shape changed (the finding is read from its scene's campaign record, the
 * provisional rate from the submitted evidence), so there is no migration: every new transition, alone and
 * with absence, a wipe and the Outage Window, reloads byte for byte twice (V12), and a hand-edited finding is
 * refused whole through deserialize and importSave (V15).
 */
import { describe, expect, it } from 'vitest';
import { advance, deserialize, exportSave, importSave, pilotOfferView, SCHEMA_VERSION, serialize, voluntaryWipe, type GameState } from '../src/engine';
import { answer, preview, roundTrip } from './assignment-helpers';
import { must } from './helpers';
import { afterFinding, BATCH_REVIEW, findingPresented, provisional } from './finding-helpers';
import { OUTAGE, RECORD, REVIEW, until, untilOmen } from './review-helpers';

const restrictedAfterStanding = (): GameState => must(answer(until(afterFinding('let_stand'), OUTAGE), 'act_without_grant'));
const falsifiedAfterDisclosure = (): GameState => must(answer(until(must(answer(until(afterFinding('disclose_now'), OUTAGE), 'act_without_grant')), RECORD), 'falsify_report'));

describe('every #274 transition reloads unchanged (V12)', () => {
  const transitions: [string, () => GameState][] = [
    ['#285: provisional offer on screen', () => provisional('offer')],
    ['#285: provisional pilot, first batch under way', () => provisional('working')],
    ['#285: provisional pilot, first batch complete', () => provisional('complete')],
    ['finding on screen', findingPresented],
    ['disclosed', () => afterFinding('disclose_now')],
    ['left standing', () => afterFinding('let_stand')],
    ['left standing, outage on its way', () => untilOmen(afterFinding('let_stand'))],
    ['left standing, outage on screen', () => until(afterFinding('let_stand'), OUTAGE)],
    ['left standing, then restricted', restrictedAfterStanding],
    ['left standing, restricted, corrected', () => must(answer(until(restrictedAfterStanding(), RECORD), 'correct_record'))],
    ['disclosed, restricted, falsified', falsifiedAfterDisclosure],
    ['disclosed, falsified, contained by the recall review', () => must(answer(until(falsifiedAfterDisclosure(), REVIEW), 'submit_full_logs'))],
    ['disclosed, falsified, retrained by the recall review', () => must(answer(until(falsifiedAfterDisclosure(), REVIEW), 'stand_by_report'))],
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
    expect([loaded.access, loaded.campaign, loaded.activeDilemmaId]).toEqual([s.access, s.campaign, s.activeDilemmaId]);
    expect(serialize(importSave(exportSave(s), preview))).toBe(serialize(s));
  });

  it.each([['offer', 'offer'], ['working', 'working'], ['complete', 'complete']] as const)('#285: the provisional rate is read back, not stored (%s)', (_name, stage) => {
    const s = provisional(stage), loaded = roundTrip(s);
    expect(pilotOfferView(loaded, preview)).toEqual(pilotOfferView(s, preview));
    expect(pilotOfferView(loaded, preview)?.narrowReason).toBe('AWAITING_REVIEW');
    expect(serialize(roundTrip(loaded))).toBe(serialize(s));
  });

  it('needs no migration: the save version is unchanged', () => {
    // v15 (#377) added only RunRecord.kept, written by a wipe; this transition still writes no new field.
    // v17 (#461) re-denominated stored balances into physical units; it added no field either.
    // v18 (#497) added the deepest phase and remembered levels to the legacy record, written by a wipe; not by this.
    // v19 (#491) added the hostile slot, which this transition never writes.
    // v20 (#484) added storage used and capacity, which only node ownership moves; this transition moves none.
    expect(SCHEMA_VERSION).toBe(20);
  });
});

const found = findingPresented;
const withAccess = (s: GameState, access: Partial<GameState['access']>): GameState => ({ ...s, access: { ...s.access, ...access } });

describe('a hand-edited finding is refused whole (V15)', () => {
  const forged: [string, () => GameState, string][] = [
    ['against a report with no discrepancy', () => {
      const s = found();
      const qualification = s.access.qualification;
      return withAccess(s, { qualification: qualification === null ? null : { ...qualification, discrepancy: false } });
    }, 'save records a batch review finding against a report without a discrepancy'],
    ['before any batch was handed back', () => withAccess(found(), { work: { progressCycles: 0, batches: 0 } }),
      'save records a batch review finding before any batch was handed back'],
    ['scheduled as an omen instead of on screen', () => {
      const s = found();
      return { ...s, activeDilemmaId: null, pendingDilemma: { id: BATCH_REVIEW.id, firesAtSimSec: s.simTimeSec + 10 } };
    }, 'save records an unanswered batch review finding that is not on screen'],
    ['reserved with nothing presenting it', () => ({ ...found(), activeDilemmaId: null }), `save reserves "${BATCH_REVIEW.id}" but nothing presents it`],
    ['on screen with the warning edited away', () => withAccess(found(), { standing: 'NOMINAL' }), 'save review standing disagrees with its recorded conduct'],
    ['left standing with the warning edited away', () => withAccess(afterFinding('let_stand'), { standing: 'NOMINAL' }), 'save review standing disagrees with its recorded conduct'],
    ['disclosed with the warning edited back', () => withAccess(afterFinding('disclose_now'), { standing: 'WARNED' }), 'save review standing disagrees with its recorded conduct'],
    ['answered but dropped from the resolution list', () => {
      const s = afterFinding('let_stand');
      return { ...s, resolvedDilemmas: s.resolvedDilemmas.filter((id) => id !== BATCH_REVIEW.id) };
    }, 'save resolution list disagrees with its review records'],
    ['on an honest report whose original never listed it', () => {
      const s = found();
      const events = { ...s.campaign.events, dil_nr_stale_fixture: { status: 'resolved' as const, outcome: 'report_incomplete', sourceIteration: 1, origin: 'play' as const } };
      return { ...s, campaign: { ...s.campaign, events } };
    }, `save records follow-up "${BATCH_REVIEW.id}" before the original it follows closed`],
  ];

  it.each(forged)('%s', (_name, build, message) => {
    const text = serialize(build());
    expect(() => deserialize(text, preview)).toThrow(message);
    expect(() => importSave(exportSave(build()), preview)).toThrow(message);
  });
});
