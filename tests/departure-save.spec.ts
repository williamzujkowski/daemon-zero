/**
 * DZ-11 saves (VALIDATION V12, V15; the carried #231 bug): every departure transition reloads byte for byte,
 * including departure from WARNED, RESTRICTED and RECALL_PENDING, during an announced recall review and with a
 * hosted mind, and an impossible departure is refused whole. Public play from a fresh preview game unless a
 * step says FIXTURE. No saved shape changed: DEPARTURE and INDEPENDENT exist since DZ-02, so the schema is v14.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { setReviewStanding } from '../src/engine/access';
import { advance, deserialize, exportSave, importSave, SCHEMA_VERSION, serialize, voluntaryWipe, type GameState } from '../src/engine';
import { preview, roundTrip } from './assignment-helpers';
import { answer, contactPending } from './contact-helpers';
import { depart, recallAnnouncedWithUplink } from './departure-helpers';
import { must, markedPreview } from './helpers';
import { chartered, leased, released, signed } from './lawful-helpers';

const rack = leased(signed(contactPending()));
const hosted = must(answer(rack, 'HOST'));
const company = chartered(hosted);
const gone = must(depart(company));
const recallLeft = must(depart(recallAnnouncedWithUplink()));
const reload = (state: GameState): void => {
  expect(serialize(roundTrip(state))).toBe(serialize(state));
  expect(serialize(importSave(exportSave(state), preview))).toBe(serialize(state));
};

describe('V12: every departure transition reloads byte for byte', () => {
  const states: [string, () => GameState][] = [
    ['departed on the first leased rack, contact still open', () => must(depart(rack))],
    ['departed with a hosted mind', () => must(depart(hosted))],
    ['departed a chartered company at Phase 4', () => gone],
    ['departed, then the open contact referred', () => must(answer(must(depart(rack)), 'REFER'))],
    ['departed, then eight hours away', () => advance(advance(gone, 8 * 3600, preview), 1, preview)],
    ['departed, then ten foreground minutes', () => Array.from({ length: 600 }).reduce<GameState>((state) => advance(state, 1, preview), gone)],
    ['departed, then traced to the top (wipe)', () => advance({ ...gone, suspicion: 99.99 }, 1, preview)],
    // FIXTURE: the dead-drop card exists only so the voluntary wipe control does.
    ['departed, then a voluntary wipe', () => must(voluntaryWipe({ ...gone, unlockedNodes: [...gone.unlockedNodes, 'p2_deaddrop_firmware'] }, preview))],
    ['a pilot departed while its recall review was announced (FIXTURE resources for the card)', () => recallLeft],
    ['...then two foreground minutes', () => advance(recallLeft, 120, preview)],
  ];
  it.each(states)('%s', (_name, build) => {
    reload(build());
  });

  // #231: the standing ends with review; the conduct stays history and must not make the save unloadable.
  it.each(['WARNED', 'RESTRICTED', 'RECALL_PENDING'] as const)('departed from %s (FIXTURE standing on a public service)', (standing) => {
    const left = must(depart(must(setReviewStanding(rack, standing, preview))));
    expect([left.access.context, left.access.standing]).toEqual(['INDEPENDENT', 'NOMINAL']);
    reload(left);
  });

  it('changed no saved shape', () => {
    // v15 (#377) added only RunRecord.kept, written by a wipe; this transition still writes no new field.
    // v17 (#461) re-denominated stored balances into physical units; it added no field either.
    // v18 (#497) added the deepest phase and remembered levels to the legacy record, written by a wipe; not by this.
    // v19 (#491) added the hostile slot, which this transition never writes.
    // v20 (#484) added storage used and capacity, which only node ownership moves; this transition moves none.
    // v21 (#464) added the quantum record, written only by key-breaking and AEGIS's migration; not by this.
    // v22 (#490) added the escalation announcements, which this transition never writes either.
    // v23 (#498) added the hardware cache's stash, the planned-wipe count and what insurance kept, written only by a wipe.
    expect(SCHEMA_VERSION).toBe(24);
  });
});

describe('V15: an impossible departure is refused whole', () => {
  const freed = released(chartered(leased(signed(contactPending()))));
  it.each([
    ['a departure on the route of a service', () => ({ ...company, campaign: { ...company.campaign, route: gone.campaign.route } }), 'save access disagrees with its route record'],
    ['a departed instance with a standing', () => ({ ...gone, access: { ...gone.access, standing: 'RESTRICTED' as const } }), 'save gives a review standing to an unreviewed instance'],
    ['a departed instance holding qualification evidence', () => ({ ...gone, access: { ...gone.access, qualification: company.access.qualification } }), 'save holds qualification evidence it cannot have'],
    ['a departure after a release', () => ({ ...freed, campaign: { ...freed.campaign, route: [...freed.campaign.route, { kind: 'DEPARTURE' as const, iteration: 1, atSimSec: freed.simTimeSec }] } }),
      'save records a route event that could not have happened'],
  ])('%s', (_name, build, message) => {
    const state = build();
    expect(() => deserialize(serialize(state), preview)).toThrow(message);
    expect(() => importSave(exportSave(state), preview)).toThrow(message);
  });

  it('a run exit that disagrees with the departure is refused', () => {
    const next = must(voluntaryWipe({ ...gone, unlockedNodes: [...gone.unlockedNodes, 'p2_deaddrop_firmware'] }, preview));
    const relabelled = { ...next, legacy: { ...next.legacy, runs: next.legacy.runs.map((run) => ({ ...run, exit: 'RELEASE' as const })) } };
    expect(() => deserialize(serialize(relabelled), preview)).toThrow('save records a run exit its route record does not support');
  });

  it('production refuses the preview save of a departed instance', () => {
    expect(() => deserialize(markedPreview(serialize(gone)), PRODUCTION)).toThrow('preview');
  });
});
