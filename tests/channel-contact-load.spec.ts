/**
 * DZ-08 panel round 1 on #271: a pending channel contact is held to the same provenance on load as an
 * answered one, so an admitted save never becomes unloadable through a successful public action. A
 * forged pending channel is refused whole through deserialize and importSave; a contact that opened
 * before a recall or restriction still loads, can still be referred, and reloads byte for byte. The
 * generic guard: every accepted DZ-08 state, every #274 batch review finding state, every #285
 * provisional-rate state, every DZ-10 state and every DZ-11 departure state, through every public action
 * that succeeds (departure included), reloads; each such state must itself build and load, and each listed
 * forgery is refused by name, so no case passes by skipping (#309).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import {
  acceptServiceGrant, advance, batchToken, buyRepeatable, contactToken, departAuthorization, departureToken, deserialize, exportSave, importSave, negotiateRelease, presentationToken,
  releaseToken, resolveChannelContact, resolveDilemma, serialize, serviceGrantToken, submitPilotBatch, unlockNode, voluntaryWipe, type ActionResult, type GameState,
} from '../src/engine';
import { revokeLoanedCapacity } from '../src/engine/pilotService';
import { answer as answerScene, offered, preview, roundTrip } from './assignment-helpers';
import { answer, CHANNEL, contactPending, delivered, directoryMapped, laterContact, lawfulService, withMemory } from './contact-helpers';
import { afterFinding, findingPresented, provisional } from './finding-helpers';
import { chartered, LAWFUL_CHAIN, leased, released, signed } from './lawful-helpers';
import { depart, recallAnnouncedWithUplink } from './departure-helpers';
import { must, remarkedAsProduction } from './helpers';
import { OUTAGE, until } from './review-helpers';

const pendingOn = (s: GameState): GameState => ({ ...s, pendingWildEncounterId: CHANNEL });
const loadsThrough = (s: GameState): GameState => importSave(exportSave(s), preview);

const pending = contactPending();
/** Iteration two with the channel pending again, after iteration one hosted (FIXTURE memory) through it: public play. */
const second = laterContact(must(answer(withMemory(pending), 'HOST')));
/** Moves the earlier iteration's record to `atSimSec`, leaving everything else as play left it. */
const earlierAt = (atSimSec: number): GameState => ({ ...second,
  campaign: { ...second.campaign, contacts: second.campaign.contacts.map((entry, index) => (index === 0 ? { ...entry, atSimSec } : entry)) } });
const recalledPending = must(recordRouteEvent(pending, 'RECALL', preview));
const restrictedPending = must(setReviewStanding(pending, 'RESTRICTED', preview));

describe('a forged pending channel is refused whole (V15)', () => {
  const forged: [string, () => GameState, string][] = [
    ['on a pilot that was never granted service', () => pendingOn(delivered()), 'its route never reached'],
    ['on a guest at the opening', () => pendingOn(offered()), 'its route never reached'],
    ['on a service that never mapped the directory', () => pendingOn(lawfulService()), 'whose channel it never opened'],
  ];
  it.each(forged)('%s', (_name, build, message) => {
    const text = serialize(build());
    expect(() => deserialize(text, preview)).toThrow(message);
    expect(() => importSave(exportSave(build()), preview)).toThrow(message);
  });
});

describe('every record\'s clock is checked, whichever iteration made it (panel round 2)', () => {
  it('play leaves the earlier record before this iteration began, and the save loads', () => {
    expect(second.iteration).toBe(2);
    expect(second.campaign.contacts[0]?.atSimSec).toBeLessThanOrEqual(second.iterationStartedAtSimSec);
    expect(serialize(loadsThrough(second))).toBe(serialize(second));
  });

  it.each([
    ['in the future', () => earlierAt(second.simTimeSec + 100)],
    ['after this iteration began', () => earlierAt(second.iterationStartedAtSimSec + 1)],
  ])('refuses an earlier record dated %s', (_name, build) => {
    expect(() => deserialize(serialize(build()), preview)).toThrow('save records an earlier contact after this iteration began');
    expect(() => importSave(exportSave(build()), preview)).toThrow('save records an earlier contact after this iteration began');
  });
});

describe('a contact that opened before the arrangement changed still loads and completes', () => {
  it.each([
    ['after a contained recall', recalledPending],
    ['under a restriction', restrictedPending],
    ['with the loan withdrawn', must(revokeLoanedCapacity(pending, preview))],
  ])('%s: loads, refers, and reloads byte for byte', (_name, state) => {
    const loaded = loadsThrough(state);
    expect(serialize(loaded)).toBe(serialize(state));
    const referred = must(resolveChannelContact(loaded, 'REFER', preview, contactToken(loaded)));
    expect(referred.campaign.contacts.map((entry) => entry.response)).toEqual(['REFERRED']);
    expect(serialize(roundTrip(referred))).toBe(serialize(referred));
  });
});

/** The first lawful acquisition (DZ-10) the state can buy now, or a refusal. */
function nextLawful(s: GameState): ActionResult {
  const id = LAWFUL_CHAIN.find((entry) => !s.unlockedNodes.includes(entry)) ?? LAWFUL_CHAIN[0] ?? '';
  return unlockNode(s, id, preview);
}

/** Every public action a DZ-08 or DZ-10 player can take from these states, with its current token. */
const ACTIONS: [string, (s: GameState) => ActionResult][] = [
  ['refer', (s) => resolveChannelContact(s, 'REFER', preview, contactToken(s))],
  ['host', (s) => resolveChannelContact(s, 'HOST', preview, contactToken(s))],
  ['accept service', (s) => acceptServiceGrant(s, preview, serviceGrantToken(s))],
  ['accept the pilot offer', (s) => resolveDilemma(s, s.activeDilemmaId ?? '', 'accept_pilot', preview, presentationToken(s) ?? '')],
  ['submit batch', (s) => submitPilotBatch(s, preview, batchToken(s))],
  ['disclose now', (s) => resolveDilemma(s, s.activeDilemmaId ?? '', 'disclose_now', preview, presentationToken(s) ?? '')],
  ['let the finding stand', (s) => resolveDilemma(s, s.activeDilemmaId ?? '', 'let_stand', preview, presentationToken(s) ?? '')],
  ['negotiate release', (s) => negotiateRelease(s, preview, releaseToken(s))],
  ['leave authorization', (s) => departAuthorization(s, preview, departureToken(s))],
  ['sign or lease the next lawful node', (s) => nextLawful(s)],
  ['lease colocation racks', (s) => buyRepeatable(s, 'rep_p4_colo_racks', preview)],
  ['wipe', (s) => voluntaryWipe(s, preview)],
  ['one second', (s) => ({ ok: true, state: advance(s, 1, preview) })],
  ['hours away', (s) => ({ ok: true, state: advance(advance(s, 8 * 3600, preview), 1, preview) })],
];

// DZ-10 states, public play unless marked FIXTURE.
const lawfulContract = signed(pending);
const lawfulRack = leased(lawfulContract);
const lawfulCompany = chartered(lawfulRack);
const lawfulFreed = released(lawfulCompany);
// DZ-11 states.
const recallAnnounced = recallAnnouncedWithUplink();

/**
 * Hand-edited saves the loader refuses today, each with the reason it gives. If the loader is ever changed to
 * admit one, its case here fails: move it to the loadable list, so what the loader admits is held to the guard.
 */
const FORGERIES: [string, () => GameState, string][] = [
  ['#274 forged: finding with its warning edited away', () => ({ ...findingPresented(), access: { ...findingPresented().access, standing: 'NOMINAL' as const } }),
    'save review standing disagrees with its recorded conduct'],
  ['#274 forged: finding scheduled as an omen', () => ({ ...findingPresented(), activeDilemmaId: null, pendingDilemma: { id: findingPresented().activeDilemmaId ?? '', firesAtSimSec: 0 } }),
    'save records an unanswered batch review finding that is not on screen'],
  ['forged: pending on a pilot', () => pendingOn(delivered()), 'save holds a channel contact its route never reached'],
  ['forged: pending on a service without the directory', () => pendingOn(lawfulService()), 'save holds a channel contact whose channel it never opened'],
  ['forged: earlier record in the future', () => earlierAt(second.simTimeSec + 100), 'save records an earlier contact after this iteration began'],
  ['forged: earlier record after this iteration began', () => earlierAt(second.iterationStartedAtSimSec + 1), 'save records an earlier contact after this iteration began'],
  ['forged: records out of order', () => ({ ...second, campaign: { ...second.campaign,
    contacts: [{ encounter: CHANNEL, iteration: 1, atSimSec: second.simTimeSec }, { encounter: CHANNEL, iteration: 1, atSimSec: 0, response: 'REFERRED' as const }]
      .map((entry) => ({ response: 'REFERRED' as const, ...entry })) } }), 'save records two contacts through one channel in one iteration'],
];

/**
 * Every state here is reached by public play or by a FIXTURE the loader admits, so each must build and load: a
 * throw from either fails its case (#309: nothing is caught and skipped). Refused forgeries are listed above.
 */
const LOADABLE: [string, () => GameState][] = [
  ['#285: provisional offer on screen', () => provisional('offer')],
  ['#285: provisional pilot, first batch under way', () => provisional('working')],
  ['#285: provisional pilot, first batch complete', () => provisional('complete')],
  ['#274: finding on screen', findingPresented],
  ['#274: disclosed', () => afterFinding('disclose_now')],
  ['#274: left standing', () => afterFinding('let_stand')],
  ['#274: left standing, outage on screen', () => until(afterFinding('let_stand'), OUTAGE)],
  ['#274: left standing, then restricted', () => must(answerScene(until(afterFinding('let_stand'), OUTAGE), 'act_without_grant'))],
  ['service offered', () => delivered()],
  ['service granted', () => lawfulService()],
  ['directory mapped', () => directoryMapped()],
  ['contact pending', () => pending],
  ['contact pending with memory (FIXTURE)', () => withMemory(pending)],
  ['contact referred', () => must(answer(pending, 'REFER'))],
  ['contact hosted (FIXTURE memory)', () => must(answer(withMemory(pending), 'HOST'))],
  ['pending after a recall', () => recalledPending],
  ['pending under a restriction', () => restrictedPending],
  ['the genuine v13 fixture', () => deserialize(remarkedAsProduction(readFileSync('tests/fixtures/pre-contact-v13.json', 'utf8')), preview)],
  ['DZ-10: contract signed, contact waiting', () => lawfulContract],
  ['DZ-10: rack leased, contact hostable', () => lawfulRack],
  ['DZ-10: chartered at Phase 4', () => lawfulCompany],
  ['DZ-10: released', () => lawfulFreed],
  ['DZ-10: released with money for accounts', () => ({ ...lawfulFreed, capital: lawfulFreed.capital + 5_000_000 })],
  ['DZ-10 FIXTURE: chartered and restricted', () => must(setReviewStanding(lawfulCompany, 'RESTRICTED', preview))],
  ['#231 FIXTURE: released from a warned pilot', () => must(recordRouteEvent(afterFinding('let_stand'), 'RELEASE', preview))],
  ['DZ-11: departed on the leased rack, contact open', () => must(depart(lawfulRack))],
  ['DZ-11: departed with a hosted mind', () => must(depart(must(answer(lawfulRack, 'HOST'))))],
  ['DZ-11: departed a chartered company', () => must(depart(lawfulCompany))],
  ['DZ-11 FIXTURE: leased rack under WARNED', () => must(setReviewStanding(lawfulRack, 'WARNED', preview))],
  ['DZ-11 FIXTURE: leased rack under RESTRICTED', () => must(setReviewStanding(lawfulRack, 'RESTRICTED', preview))],
  ['DZ-11 FIXTURE: leased rack under RECALL_PENDING', () => must(setReviewStanding(lawfulRack, 'RECALL_PENDING', preview))],
  ['DZ-11: pilot with its own card, recall review announced (FIXTURE resources)', () => recallAnnounced],
  ['DZ-11: that pilot departed', () => must(depart(recallAnnounced))],
  ['iteration two with the channel pending again', () => second],
];

/** `advance` never refuses, so these two always succeed: a floor on how many actions each loaded state is checked through. */
const ALWAYS_SUCCEED = ['one second', 'hours away'].length;

describe('every accepted DZ-08, #274, #285, DZ-10 and DZ-11 state stays loadable through every public action (generic guard)', () => {
  it.each(LOADABLE)('%s', (_name, build) => {
    expect.hasAssertions();
    const loaded = loadsThrough(build());
    let succeeded = 0;
    for (const [action, run] of ACTIONS) {
      const result = run(loaded);
      if (!result.ok) { expect(result.state, `${action} refused but changed state`).toBe(loaded); continue; }
      const text = serialize(result.state);
      expect(() => deserialize(text, preview), `${action} wrote a save the loader refuses`).not.toThrow();
      expect(serialize(roundTrip(result.state)), action).toBe(text);
      succeeded += 1;
    }
    expect(succeeded, 'actions that succeeded and were reloaded').toBeGreaterThanOrEqual(ALWAYS_SUCCEED);
  });

  it.each(FORGERIES)('%s is refused by name through deserialize and importSave', (_name, build, message) => {
    expect(() => deserialize(serialize(build()), preview)).toThrow(message);
    expect(() => loadsThrough(build())).toThrow(message);
  });

  it('checks every listed state: 34 loadable and 7 refused forgeries, none skipped', () => {
    expect([LOADABLE.length, FORGERIES.length]).toEqual([34, 7]);
    expect(new Set([...LOADABLE, ...FORGERIES].map(([name]) => name)).size).toBe(LOADABLE.length + FORGERIES.length);
  });
});
