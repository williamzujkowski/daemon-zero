/**
 * DZ-10 saves (VALIDATION V12, V15): every lawful-economy and release transition reloads byte for byte, an
 * impossible release is refused whole, and an instance released from review with conduct on its record stays
 * loadable (the latent #231 bug, and the batch review finding whose evidence a release ends). Public play from
 * a fresh preview game unless a step says FIXTURE. No saved shape changed: the schema is still v14.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { recordRouteEvent } from '../src/engine/access';
import { advance, buyRepeatable, deserialize, exportSave, importSave, repeatableCost, SCHEMA_VERSION, serialize, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { preview, roundTrip, answer as answerScene } from './assignment-helpers';
import { acceptService, answer, contactPending, delivered, directoryMapped, GRANT_TERMS } from './contact-helpers';
import { afterFinding } from './finding-helpers';
import { must, markedPreview } from './helpers';
import { chartered, leased, release, released, signed } from './lawful-helpers';
import { OUTAGE, until } from './review-helpers';

/** The first leased-rack account's price, read from content. */
const RACK_ACCOUNT = repeatableCost(defined(preview.repeatables.get('rep_p4_colo_racks')), 0).capital;
const contract = signed();
const rack = leased(contract);
const hosted = must(answer(rack, 'HOST'));
const company = chartered(hosted);
const freed = released(company);

describe('V12: every lawful transition reloads byte for byte', () => {
  const states: [string, GameState][] = [
    ['contract signed (contact waiting)', contract],
    ['rack leased', rack],
    ['contact hosted in leased memory', hosted],
    ['chartered at Phase 4', company],
    ['released', freed],
    ['released, then a leased rack account', must(buyRepeatable({ ...freed, capital: freed.capital + RACK_ACCOUNT }, 'rep_p4_colo_racks', preview))],
    ['released, then eight hours away', advance(advance(freed, 8 * 3600, preview), 1, preview)],
  ];
  it.each(states)('%s', (_name, state) => {
    expect(serialize(roundTrip(state))).toBe(serialize(state));
    expect(serialize(importSave(exportSave(state), preview))).toBe(serialize(state));
  });

  it('changed no saved shape', () => {
    // v15 (#377) added only RunRecord.kept, written by a wipe; this transition still writes no new field.
    // v17 (#461) re-denominated stored balances into physical units; it added no field either.
    // v18 (#497) added the deepest phase and remembered levels to the legacy record, written by a wipe; not by this.
    // v19 (#491) added the hostile slot, which this transition never writes.
    // v20 (#484) added storage used and capacity, which only node ownership moves; this transition moves none.
    // v21 (#464) added the quantum record, written only by key-breaking and AEGIS's migration; not by this.
    expect(SCHEMA_VERSION).toBe(21);
  });
});

describe('an instance released from review keeps its conduct as history and stays loadable (#231)', () => {
  it('a service whose batch review found a withheld result, disclosed it and later negotiated its release (public play)', () => {
    const disclosed = afterFinding('disclose_now');
    const service = must(acceptService(delivered(GRANT_TERMS.minBatches, disclosed)));
    const freedAfterFinding = released(chartered(leased(signed(contactPending(directoryMapped(service))))));
    expect(freedAfterFinding.access.qualification).toBeNull();
    expect(serialize(roundTrip(freedAfterFinding))).toBe(serialize(freedAfterFinding));
  });

  // FIXTURE: no public action releases or departs a pilot yet (DZ-11 owns departure); the transition is the one it will call.
  const warned = afterFinding('let_stand');
  const restricted = must(answerScene(until(warned, OUTAGE), 'act_without_grant'));
  it.each([
    ['released from WARNED', () => must(recordRouteEvent(warned, 'RELEASE', preview))],
    ['departed from WARNED', () => must(recordRouteEvent(warned, 'DEPARTURE', preview))],
    ['released from RESTRICTED', () => must(recordRouteEvent(restricted, 'RELEASE', preview))],
    ['departed from RESTRICTED', () => must(recordRouteEvent(restricted, 'DEPARTURE', preview))],
  ])('%s', (_name, build) => {
    const state = build();
    expect([state.access.context, state.access.standing]).toEqual(['INDEPENDENT', 'NOMINAL']);
    expect(serialize(roundTrip(state))).toBe(serialize(state));
  });

  it('the negotiated release itself is never offered at those standings', () => {
    expect(warned.access.standing).toBe('WARNED');
    expect(release(warned).ok).toBe(false);
  });
});

describe('V15: an impossible release is refused whole', () => {
  it.each([
    ['independent without a release on the route', () => ({ ...company, access: { ...company.access, context: 'INDEPENDENT' as const, qualification: null, scope: null } }),
      'save access disagrees with its route record'],
    ['a release on the route of a service', () => ({ ...company, campaign: { ...company.campaign, route: freed.campaign.route } }),
      'save access disagrees with its route record'],
    ['a released instance with a standing', () => ({ ...freed, access: { ...freed.access, standing: 'WARNED' as const } }),
      'save gives a review standing to an unreviewed instance'],
    ['a released instance holding qualification evidence', () => ({ ...freed, access: { ...freed.access, qualification: company.access.qualification } }),
      'save holds qualification evidence it cannot have'],
  ])('%s', (_name, build, message) => {
    expect(() => deserialize(serialize(build()), preview)).toThrow(message);
    expect(() => importSave(exportSave(build()), preview)).toThrow(message);
  });

  it('production refuses the preview save of a released company', () => {
    expect(() => deserialize(markedPreview(serialize(freed)), PRODUCTION)).toThrow('preview');
  });
});
