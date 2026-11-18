/**
 * DZ-08 saves: every new transition reloads byte for byte twice (serialize -> deserialize ->
 * serialize, V12), the migration step that adds the contact record, and each impossible contact
 * record refused whole rather than healed (V15).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { recordRouteEvent } from '../src/engine/access';
import { advance, createInitialState, deserialize, MIGRATIONS, serialize, voluntaryWipe, type ChannelContact, type GameState } from '../src/engine';
import { restoreLoanedCapacity, revokeLoanedCapacity } from '../src/engine/pilotService';
import { freshCampaign, live, preview, roundTrip } from './assignment-helpers';
import { acceptService, answer, CHANNEL, contactPending, delivered, directoryMapped, lawfulService, MERCY, withMemory } from './contact-helpers';
import { must, remarkedAsProduction, markedPreview } from './helpers';

const V13_PREVIEW = readFileSync('tests/fixtures/pre-contact-v13.json', 'utf8');
/** Re-marked by hand: production refuses the genuine preview save above (X.3). */
const V13 = remarkedAsProduction(V13_PREVIEW);
/** The migration step that adds `campaign.contacts`. */
const CONTACT_STEP = 13;
const pending = contactPending();
const hosted = must(answer(withMemory(pending), 'HOST'));
const referred = must(answer(pending, 'REFER'));

describe('every DZ-08 transition reloads unchanged (V12)', () => {
  const cases: [string, () => GameState][] = [
    ['service offered', () => delivered()],
    ['service granted', () => lawfulService()],
    ['directory mapped, channel closed', () => directoryMapped()],
    ['contact pending', () => pending],
    ['contact referred', () => referred],
    ['contact hosted (FIXTURE memory)', () => hosted],
    ['hosted, loan withdrawn', () => must(revokeLoanedCapacity(hosted, preview))],
    ['hosted, loan withdrawn and restored', () => must(restoreLoanedCapacity(must(revokeLoanedCapacity(hosted, preview)), preview))],
    ['hosted, service recalled', () => must(recordRouteEvent(hosted, 'RECALL', preview))],
    ['contact pending, back from hours away', () => advance(advance(pending, 8 * 3600, preview), 1, preview)],
    ['hosted, back from hours away', () => advance(advance(hosted, 8 * 3600, preview), 1, preview)],
    ['referred, then wiped', () => must(voluntaryWipe(referred, preview))],
    ['hosted, then wiped', () => must(voluntaryWipe(hosted, preview))],
    ['contact pending, then wiped', () => must(voluntaryWipe(pending, preview))],
  ];
  it.each(cases)('%s', (_name, build) => {
    const s = build();
    const loaded = roundTrip(s);
    expect(serialize(loaded)).toBe(serialize(s));
    expect([loaded.campaign.contacts, loaded.activeShards, loaded.pendingWildEncounterId]).toEqual([s.campaign.contacts, s.activeShards, s.pendingWildEncounterId]);
  });

  it('time away neither answers the contact nor releases the hosted mind (V17)', () => {
    const away = advance(advance(pending, 8 * 3600, preview), 1, preview);
    expect([away.pendingWildEncounterId, away.campaign.contacts]).toEqual([CHANNEL, []]);
    const hostedAway = advance(advance(hosted, 8 * 3600, preview), 1, preview);
    expect(hostedAway.activeShards[MERCY]?.count).toBe(1);
    expect(hostedAway.memoryUsed).toBe(hosted.memoryUsed);
  });

  it('a wipe while the contact waits closes it without an answer', () => {
    const next = must(voluntaryWipe(pending, preview));
    expect([next.pendingWildEncounterId, next.campaign.contacts]).toEqual([null, []]);
  });
});

describe('the contact-record migration step', () => {
  it('adds an empty contact record and keeps every other campaign field', () => {
    const save = { schemaVersion: CONTACT_STEP, campaign: { activatedAtIteration: 1, route: [{ kind: 'PROMOTION' }], clue: null } };
    expect(MIGRATIONS[CONTACT_STEP]?.(save)).toEqual({ ...save, campaign: { ...save.campaign, contacts: [] } });
  });

  it('a save of the previous version without the field loads with no contacts', () => {
    const raw = JSON.parse(serialize(lawfulService())) as Record<string, unknown> & { campaign: Record<string, unknown> };
    const campaign = Object.fromEntries(Object.entries(raw.campaign).filter(([key]) => key !== 'contacts'));
    const older = { ...raw, schemaVersion: CONTACT_STEP, campaign };
    const loaded = deserialize(JSON.stringify(older), preview);
    expect(loaded.campaign.contacts).toEqual([]);
    expect(serialize(roundTrip(loaded))).toBe(serialize(loaded));
  });
});

describe('the genuine v13 fixture (tests/fixtures/README.md)', () => {
  it('is a v13 preview save of a nominal pilot with two delivered batches and no contact record', () => {
    const raw = JSON.parse(V13_PREVIEW) as { schemaVersion: number; contentChannel: string; campaign: Record<string, unknown>; access: { context: string; work: { batches: number } } };
    expect([raw.schemaVersion, raw.contentChannel, raw.access.context, raw.access.work.batches]).toEqual([CONTACT_STEP, 'preview', 'PILOT', 2]);
    expect('contacts' in raw.campaign).toBe(false);
  });

  it('loads with an empty contact record, reloads unchanged, and goes on to the channel by public play', () => {
    const loaded = deserialize(V13, preview);
    expect(loaded.campaign.contacts).toEqual([]);
    expect(serialize(roundTrip(loaded))).toBe(serialize(loaded));
    const contact = contactPending(directoryMapped(must(acceptService(loaded))));
    expect(contact.pendingWildEncounterId).toBe(CHANNEL);
    expect(roundTrip(must(answer(contact, 'REFER'))).campaign.contacts).toHaveLength(1);
  });

  it('production refuses it before reading anything', () => {
    expect(() => deserialize(V13_PREVIEW, PRODUCTION)).toThrow('preview');
  });
});

type Edit = (s: GameState) => GameState;
const withContacts = (s: GameState, contacts: ChannelContact[]): GameState => ({ ...s, campaign: { ...s.campaign, contacts } });
const entry = (s: GameState, extra: Partial<ChannelContact> = {}): ChannelContact =>
  ({ encounter: CHANNEL, iteration: s.iteration, atSimSec: s.simTimeSec, response: 'REFERRED', ...extra });

describe('impossible contact records are refused, never healed (V15)', () => {
  const refusals: [string, () => GameState, Edit, string][] = [
    ['a contact under legacy rules', () => freshCampaign(), (s) => withContacts({ ...s, narrativeRules: 'legacy', campaign: { ...s.campaign, activatedAtIteration: null } }, [entry(s)]), 'campaign history'],
    ['a pending channel under legacy rules', () => createInitialState(preview), (s) => ({ ...s, pendingWildEncounterId: CHANNEL }), 'outside campaign rules'],
    ['an unknown channel', () => referred, (s) => withContacts(s, [entry(s, { encounter: 'channel_not_shipped' })]), 'unknown channel'],
    ['a contact in a later iteration', () => referred, (s) => withContacts(s, [entry(s, { iteration: s.iteration + 1 })]), 'outside campaign play'],
    ['a contact in the future', () => referred, (s) => withContacts(s, [entry(s, { atSimSec: s.simTimeSec + 5 })]), 'outside this iteration'],
    ['two contacts through one channel in one iteration', () => referred, (s) => withContacts(s, [entry(s, { atSimSec: s.simTimeSec - 1 }), entry(s)]), 'two contacts through one channel'],
    ['contacts out of order', () => must(voluntaryWipe(referred, preview)), (s) => withContacts(s, [entry(s, { iteration: 2 }), entry(s, { iteration: 1, atSimSec: 1 })]), 'out of order'],
    ['a contact a guest never reached', () => freshCampaign(), (s) => withContacts(live(s, 3), [entry(live(s, 3))]), 'its route never reached'],
    ['hosting the cohort no longer holds', () => hosted, (s) => ({ ...s, activeShards: {}, memoryUsed: s.memoryUsed - (s.activeShards[MERCY]?.memoryAllocatedMb ?? 0) }), 'hosting this instance does not hold'],
    ['an answered channel pending again', () => referred, (s) => ({ ...s, pendingWildEncounterId: CHANNEL }), 'already answered'],
  ];
  it.each(refusals)('refuses %s', (_name, build, edit, message) => {
    const text = serialize(edit(build()));
    expect(() => deserialize(text, preview)).toThrow(message);
  });

  it('production refuses a preview save holding a contact before it reads anything', () => {
    expect(() => deserialize(markedPreview(serialize(referred)), PRODUCTION)).toThrow('preview');
  });

  it('a valid record from an earlier iteration needs no cohort and loads unchanged', () => {
    const next = must(voluntaryWipe(hosted, preview));
    expect(next.campaign.contacts[0]?.response).toBe('HOSTED');
    expect(roundTrip(next)).toEqual(next);
  });

  it('the service granted again in the same save loads as reached, so no transition writes what the loader refuses', () => {
    expect(roundTrip(must(acceptService(delivered())))).toBeDefined();
  });
});
