/**
 * DZ-08 panel round 1 on #271: a pending channel contact is held to the same provenance on load as an
 * answered one, so an admitted save never becomes unloadable through a successful public action. A
 * forged pending channel is refused whole through deserialize and importSave; a contact that opened
 * before a recall or restriction still loads, can still be referred, and reloads byte for byte. The
 * generic guard: every accepted DZ-08 state, through every public action that succeeds, reloads.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import {
  acceptServiceGrant, advance, batchToken, contactToken, deserialize, exportSave, importSave, resolveChannelContact,
  serialize, serviceGrantToken, submitPilotBatch, voluntaryWipe, type ActionResult, type GameState,
} from '../src/engine';
import { revokeLoanedCapacity } from '../src/engine/pilotService';
import { offered, preview, roundTrip } from './assignment-helpers';
import { answer, CHANNEL, contactPending, delivered, directoryMapped, lawfulService, withMemory } from './contact-helpers';
import { must } from './helpers';

const pendingOn = (s: GameState): GameState => ({ ...s, pendingWildEncounterId: CHANNEL });
const loadsThrough = (s: GameState): GameState => importSave(exportSave(s), preview);

const pending = contactPending();
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
  ['submit batch', (s) => submitPilotBatch(s, preview, batchToken(s))],
  ['wipe', (s) => voluntaryWipe(s, preview)],
  ['one second', (s) => ({ ok: true, state: advance(s, 1, preview) })],
  ['hours away', (s) => ({ ok: true, state: advance(advance(s, 8 * 3600, preview), 1, preview) })],
];

describe('every accepted DZ-08 state stays loadable through every public action (generic guard)', () => {
  const states: [string, () => GameState][] = [
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
