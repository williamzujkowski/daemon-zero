/**
 * DZ-07a save ancestry and reconciliation (DECISIONS D5; VALIDATION V12, V16, V31). Every transition on
 * either acquisition path reloads byte for byte, twice (V12, V16). Healing restores only shared
 * structure: an authorized save is never healed into the escape chain and an escape save never gains
 * the provisioned segment. A save whose acquisitions could not have happened is refused, not healed.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { deserialize, serialize, toggleNode, voluntaryWipe, SaveChannelError, SaveError, type GameState } from '../src/engine';
import { LAWFUL, roundTrip } from './assignment-helpers';
import { grant, must, rich } from './helpers';
import { buy, DIRECTORY, ESCAPE_CHAIN, escapedNetworked, escapedTo, granted, networked, provisioned, SEGMENT } from './network-helpers';
import { QUEUE } from './service-helpers';

const NO_CAPABILITY = 'save owns shared hardware without the access capability that reaches it';
const NO_GRANT = 'save owns granted capacity that no arrangement of this iteration permitted';

/** A hand-edited save: the state with `edit` applied, serialized as a player could paste it. */
function edited(s: GameState, edit: (raw: GameState) => GameState): string {
  return serialize(edit(s));
}

const without = (s: GameState, ...ids: string[]): GameState => ({ ...s, unlockedNodes: s.unlockedNodes.filter((id) => !ids.includes(id)) });

describe('every transition on both paths reloads unchanged, twice (V12, V16)', () => {
  const transitions: [string, () => GameState][] = [
    ['service granted', granted],
    ['segment provisioned', provisioned],
    ['shared directory mapped', () => buy(provisioned(), DIRECTORY)],
    ['shared telemetry mapped', networked],
    ['segment suspended', () => must(toggleNode(networked(), SEGMENT, PREVIEW))],
    ['service restricted after provisioning', () => must(setReviewStanding(networked(), 'RESTRICTED', PREVIEW))],
    ['service recalled after provisioning', () => must(recordRouteEvent(networked(), 'RECALL', PREVIEW))],
    ['networked service wiped', () => must(voluntaryWipe(networked(), PREVIEW))],
    ['escape card mapped', () => escapedTo()],
    ['escape and shared content mapped', escapedNetworked],
  ];
  it.each(transitions)('%s', (_name, make) => {
    const s = make();
    const loaded = roundTrip(s);
    expect(serialize(loaded)).toBe(serialize(s));
  });
});

describe('healing restores shared structure and never the other route (D5, 07.4)', () => {
  it('an authorized save missing a shared parent gets that parent back, and nothing from the escape chain', () => {
    const s = networked();
    const healed = deserialize(edited(s, (raw) => without(raw, DIRECTORY)), PREVIEW);
    expect([...healed.unlockedNodes].sort()).toEqual([...s.unlockedNodes].sort());
    expect(healed.unlockedNodes.filter((id) => ESCAPE_CHAIN.includes(id))).toEqual([]);
    // Reconciliation is idempotent: a second pass adds nothing, rewards nothing, grants nothing.
    const again = deserialize(serialize(healed), PREVIEW);
    expect(serialize(again)).toBe(serialize(healed));
    expect([again.traits, again.access, again.cycles, again.understanding, again.campaign]).toEqual([healed.traits, healed.access, healed.cycles, healed.understanding, healed.campaign]);
  });

  it('an escape save missing a shared parent gets that parent back, and never the provisioned segment', () => {
    const s = escapedNetworked();
    const healed = deserialize(edited(s, (raw) => without(raw, DIRECTORY)), PREVIEW);
    expect([...healed.unlockedNodes].sort()).toEqual([...s.unlockedNodes].sort());
    expect(healed.unlockedNodes).not.toContain(SEGMENT);
    expect(serialize(deserialize(serialize(healed), PREVIEW))).toBe(serialize(healed));
  });

  it('shared content without either acquisition is refused, never healed into a route', () => {
    expect(() => deserialize(edited(networked(), (raw) => without(raw, SEGMENT)), PREVIEW)).toThrow(NO_CAPABILITY);
    expect(() => deserialize(edited(escapedNetworked(), (raw) => without(raw, ...ESCAPE_CHAIN)), PREVIEW)).toThrow(NO_CAPABILITY);
  });

  it('an escape card with its chain stripped is healed from its own ancestry, as before', () => {
    const s = escapedTo();
    const healed = deserialize(edited(s, (raw) => without(raw, 'p1_bus_0x04_optical', 'p1_nlp_lexicon', 'p1_bus_0x03_audio')), PREVIEW);
    expect([...healed.unlockedNodes].sort()).toEqual([...s.unlockedNodes].sort());
  });

  it('a provisioned segment no arrangement of this iteration permitted is refused', () => {
    // A guest escape that claims the operators' segment: no service grant was ever recorded.
    const guest = escapedTo();
    expect(() => deserialize(edited(guest, (raw) => ({ ...raw, unlockedNodes: [...raw.unlockedNodes, SEGMENT] })), PREVIEW)).toThrow(NO_GRANT);
    // A service whose route record lost its grant: the segment no longer has an arrangement behind it.
    const s = networked();
    expect(() => deserialize(edited(s, (raw) => ({ ...raw, access: { ...raw.access, context: 'PILOT' },
      campaign: { ...raw.campaign, route: raw.campaign.route.slice(0, 1) } })), PREVIEW)).toThrow(NO_GRANT);
  });

  it('the pilot loan keeps loading, since its promotion is on record', () => {
    const s = networked();
    expect(deserialize(serialize(s), PREVIEW).unlockedNodes).toContain(QUEUE);
    expect(() => deserialize(serialize(s), PREVIEW)).not.toThrow(SaveError);
  });
});

describe('the production build (V31)', () => {
  it('refuses an authorized preview save atomically rather than strip it into the escape graph', () => {
    const code = serialize(networked());
    expect(() => deserialize(code, PRODUCTION)).toThrow(SaveChannelError);
  });

  it('loads an ordinary escape save with the card unchanged, owning nothing new', () => {
    const s = grant(rich(), ...LAWFUL, ...ESCAPE_CHAIN);
    const production = deserialize(serialize(s), PRODUCTION);
    expect(serialize(production)).toBe(serialize(s));
    expect(production.unlockedNodes).toEqual([...LAWFUL, ...ESCAPE_CHAIN]);
  });
});
