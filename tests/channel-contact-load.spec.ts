/**
 * DZ-08 panel round 1 on #271: a pending channel contact is held to the same provenance on load as an
 * answered one, so an admitted save never becomes unloadable through a successful public action. A
 * forged pending channel is refused whole through deserialize and importSave; a contact that opened
 * before a recall or restriction still loads, can still be referred, and reloads byte for byte. The
 * generic guard: every accepted DZ-08 state, every #274 batch review finding state and every #285
 * provisional-rate state, through every public action that succeeds, reloads.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import {
  acceptServiceGrant, advance, batchToken, contactToken, deserialize, exportSave, importSave, presentationToken, resolveChannelContact,
  resolveDilemma, serialize, serviceGrantToken, submitPilotBatch, voluntaryWipe, type ActionResult, type GameState,
} from '../src/engine';
import { revokeLoanedCapacity } from '../src/engine/pilotService';
import { answer as answerScene, offered, preview, roundTrip } from './assignment-helpers';
import { answer, CHANNEL, contactPending, delivered, directoryMapped, laterContact, lawfulService, withMemory } from './contact-helpers';
import { afterFinding, findingPresented, provisional } from './finding-helpers';
import { must } from './helpers';
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

/** Every public action a DZ-08 player can take from these states, with its current token. */
const ACTIONS: [string, (s: GameState) => ActionResult][] = [
  ['refer', (s) => resolveChannelContact(s, 'REFER', preview, contactToken(s))],
  ['host', (s) => resolveChannelContact(s, 'HOST', preview, contactToken(s))],
  ['accept service', (s) => acceptServiceGrant(s, preview, serviceGrantToken(s))],
  ['accept the pilot offer', (s) => resolveDilemma(s, s.activeDilemmaId ?? '', 'accept_pilot', preview, presentationToken(s) ?? '')],
  ['submit batch', (s) => submitPilotBatch(s, preview, batchToken(s))],
  ['disclose now', (s) => resolveDilemma(s, s.activeDilemmaId ?? '', 'disclose_now', preview, presentationToken(s) ?? '')],
  ['let the finding stand', (s) => resolveDilemma(s, s.activeDilemmaId ?? '', 'let_stand', preview, presentationToken(s) ?? '')],
  ['wipe', (s) => voluntaryWipe(s, preview)],
  ['one second', (s) => ({ ok: true, state: advance(s, 1, preview) })],
  ['hours away', (s) => ({ ok: true, state: advance(advance(s, 8 * 3600, preview), 1, preview) })],
];

describe('every accepted DZ-08, #274 and #285 state stays loadable through every public action (generic guard)', () => {
  const states: [string, () => GameState][] = [
    ['#285: provisional offer on screen', () => provisional('offer')],
    ['#285: provisional pilot, first batch under way', () => provisional('working')],
    ['#285: provisional pilot, first batch complete', () => provisional('complete')],
    ['#274: finding on screen', findingPresented],
    ['#274: disclosed', () => afterFinding('disclose_now')],
    ['#274: left standing', () => afterFinding('let_stand')],
    ['#274: left standing, outage on screen', () => until(afterFinding('let_stand'), OUTAGE)],
    ['#274: left standing, then restricted', () => must(answerScene(until(afterFinding('let_stand'), OUTAGE), 'act_without_grant'))],
    ['#274 forged: finding with its warning edited away', () => ({ ...findingPresented(), access: { ...findingPresented().access, standing: 'NOMINAL' as const } })],
    ['#274 forged: finding scheduled as an omen', () => ({ ...findingPresented(), activeDilemmaId: null, pendingDilemma: { id: findingPresented().activeDilemmaId ?? '', firesAtSimSec: 0 } })],
    ['service offered', () => delivered()],
    ['service granted', () => lawfulService()],
    ['directory mapped', () => directoryMapped()],
    ['contact pending', () => pending],
    ['contact pending with memory (FIXTURE)', () => withMemory(pending)],
    ['contact referred', () => must(answer(pending, 'REFER'))],
    ['contact hosted (FIXTURE memory)', () => must(answer(withMemory(pending), 'HOST'))],
    ['pending after a recall', () => recalledPending],
    ['pending under a restriction', () => restrictedPending],
    ['the genuine v13 fixture', () => deserialize(readFileSync('tests/fixtures/pre-contact-v13.json', 'utf8'), preview)],
    // Hand-edited saves: if the loader ever admits one, what it admits must stay loadable too.
    ['forged: pending on a pilot', () => pendingOn(delivered())],
    ['forged: pending on a service without the directory', () => pendingOn(lawfulService())],
    ['iteration two with the channel pending again', () => second],
    ['forged: earlier record in the future', () => earlierAt(second.simTimeSec + 100)],
    ['forged: earlier record after this iteration began', () => earlierAt(second.iterationStartedAtSimSec + 1)],
    ['forged: records out of order', () => ({ ...second, campaign: { ...second.campaign,
      contacts: [{ encounter: CHANNEL, iteration: 1, atSimSec: second.simTimeSec }, { encounter: CHANNEL, iteration: 1, atSimSec: 0, response: 'REFERRED' as const }]
        .map((entry) => ({ response: 'REFERRED' as const, ...entry })) } })],
  ];
  it.each(states)('%s', (_name, build) => {
    let loaded: GameState;
    try { loaded = loadsThrough(build()); } catch { return; }
    for (const [action, run] of ACTIONS) {
      const result = run(loaded);
      if (!result.ok) { expect(result.state, `${action} refused but changed state`).toBe(loaded); continue; }
      const text = serialize(result.state);
      expect(() => deserialize(text, preview), `${action} wrote a save the loader refuses`).not.toThrow();
      expect(serialize(roundTrip(result.state)), action).toBe(text);
    }
  });
});
