/**
 * Campaign ids across content versions (S.N5-ids, H28): a renamed event is read through its
 * alias, a retired one is kept as a tombstone, and anything else unknown is refused rather than
 * silently dropped, because a dropped record would let its event happen again.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry } from '../src/content/registry';
import { advance, campaignHistory, campaignRecord, deserialize, endingEvidence, MIGRATIONS, serialize, type GameState } from '../src/engine';
import { activeGame, chooseCryo, cryo, preview, returnTo } from './campaign-helpers';
import { defined } from './m7-helpers';

const OLD = 'dil_cryo_old_name', GONE = 'dil_retired_incident';
const evolved = buildRegistry({ ...RAW_CONTENT, channel: 'preview',
  campaign: { ...(RAW_CONTENT.campaign as object), aliases: [{ from: OLD, to: cryo.id, since: 7 }], retired: [GONE] } });
const record = (s: GameState) => {
  const found = defined(campaignRecord(s, cryo.id));
  if (found.status !== 'resolved') throw new Error('cryo is not resolved');
  return found;
};
const withEvents = (s: GameState, events: GameState['campaign']['events']): string =>
  serialize({ ...s, campaign: { ...s.campaign, events } });

describe('renamed, retired and unknown campaign ids', () => {
  const chosen = returnTo(chooseCryo(activeGame(), 0));

  it('reads a renamed record under its new id, so the event stays consumed', () => {
    const loaded = deserialize(withEvents(chosen, { [OLD]: record(chosen) }), evolved);
    expect(campaignRecord(loaded, cryo.id)).toEqual(record(chosen));
    expect(Object.keys(loaded.campaign.events)).toEqual([cryo.id]);
    expect(advance(loaded, 120, evolved).pendingDilemma).toBeNull();
  });

  it('keeps a retired record as a tombstone that adds no score', () => {
    const loaded = deserialize(withEvents(chosen, { ...chosen.campaign.events, [GONE]: record(chosen) }), evolved);
    expect(loaded.campaign.events[GONE]).toEqual(record(chosen));
    expect(campaignHistory(loaded, evolved).find((entry) => entry.eventId === GONE)?.title).toBeNull();
    expect(endingEvidence(loaded, evolved)).toEqual(endingEvidence(chosen, evolved));
  });

  it('refuses an unknown id instead of dropping it', () => {
    const text = withEvents(chosen, { dil_from_the_future: record(chosen) });
    expect(() => deserialize(text, preview)).toThrow(/unknown campaign event "dil_from_the_future"/);
    expect(() => deserialize(withEvents(chosen, { [OLD]: record(chosen) }), preview)).toThrow(/unknown campaign event/);
  });

  it('refuses a save that holds both the old and the new id', () => {
    const text = withEvents(chosen, { [cryo.id]: record(chosen), [OLD]: record(chosen) });
    expect(() => deserialize(text, evolved)).toThrow(/twice/);
  });

  it('refuses an unknown campaign action credit', () => {
    const text = serialize({ ...chosen, campaign: { ...chosen.campaign, creditedActions: { act_missing: 'play' } } });
    expect(() => deserialize(text, preview)).toThrow(/unknown campaign action/);
  });
});

describe('new-format record contradictions are refused atomically', () => {
  const chosen = chooseCryo(activeGame(), 1);
  const forged: [string, GameState['campaign']['events'][string]][] = [
    ['an unknown outcome', { ...record(chosen), outcome: 'teleport_samples' }],
    ['legacy_unknown claimed by play', { ...record(chosen), outcome: 'legacy_unknown' }],
    ['play before activation', { ...record(chosen), sourceIteration: null }],
    ['play in a future iteration', { ...record(chosen), sourceIteration: 9 }],
    ['legacy history after activation', { ...record(chosen), origin: 'legacy', sourceIteration: 4 }],
  ];

  it.each(forged)('refuses %s', (_, bad) => {
    const text = withEvents(chosen, { [cryo.id]: bad }), copy = structuredClone(chosen);
    expect(() => deserialize(text, preview)).toThrow(/campaign|outcome|records/);
    expect(chosen).toEqual(copy);
  });

  it('refuses campaign history on a legacy save and an incomplete activation', () => {
    expect(() => deserialize(serialize({ ...chosen, narrativeRules: 'legacy' }), preview)).toThrow(/without campaign rules/);
    const incomplete = { ...chosen, campaign: { ...chosen.campaign, legacyEndingBaseline: null } };
    expect(() => deserialize(serialize(incomplete), preview)).toThrow(/incomplete campaign activation/);
    const future = { ...chosen, campaign: { ...chosen.campaign, activatedAtIteration: 5 } };
    expect(() => deserialize(serialize(future), preview)).toThrow(/incomplete campaign activation/);
  });
});

describe('the v5 to v6 migration step', () => {
  it('adds inactive history and never activates', () => {
    expect(MIGRATIONS[5]?.({ schemaVersion: 5, cycles: 1 })).toEqual({ schemaVersion: 5, cycles: 1, narrativeRules: 'legacy',
      campaign: { activatedAtIteration: null, legacyEndingBaseline: null, events: {}, creditedActions: {}, operationalEvidence: [] } });
  });
});
