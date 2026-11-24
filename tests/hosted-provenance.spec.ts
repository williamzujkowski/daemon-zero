/**
 * Panel pass 2 on #562: a grant closes only when a route event takes the arrangement from one that permits the hosting
 * grant to one that does not, and a hosting is only on record while that grant stood. Before, any event landing in an
 * arrangement without the grant counted as a closure (a promotion into a pilot, a recall that keeps a pilot a pilot), and a
 * HOSTED entry dated before the service grant loaded, so a forged history could have the ending claim a grant closed.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { deserialize, endingAccount, referHostedOnward, serialize, wipe, type GameState } from '../src/engine';
import type { RouteEvent } from '../src/engine/accessState';
import { grantClosedBetween, grantStoodAt } from '../src/engine/hostedReferral';
import { CHANNEL, hostedThen, type GrantExit } from './hosted-exit-fixtures';
import { must } from './helpers';
import { defined } from './m7-helpers';

const ENCOUNTER = defined(CONTENT.swarm.channelEncounters.find((entry) => entry.id === CHANNEL));
const PROVENANCE = 'save records hosting dated outside the grant it was hosted under';
const SERVICE_GRANT_AT = 22991;

/** FIXTURE: the standing service with only its route replaced, to ask the route rules about it directly. */
function withRoute(kinds: readonly RouteEvent['kind'][]): GameState {
  const s = hostedThen(null);
  return { ...s, campaign: { ...s.campaign, route: kinds.map((kind, index) => ({ kind, iteration: 1, atSimSec: 1000 * (index + 1) })) } };
}

/** FIXTURE: catfish's forgery: the hosting dated before the service grant, the cohort gone and a referral appended. */
function hostedBeforeGrant(): GameState {
  const s = hostedThen(null);
  const [hosted] = s.campaign.contacts;
  return { ...s, activeShards: {}, campaign: { ...s.campaign, contacts: [{ ...defined(hosted), atSimSec: 10761 },
    { encounter: CHANNEL, iteration: 1, atSimSec: s.simTimeSec, response: 'REFERRED' as const }] } };
}

describe('a grant closes only on a real transition out of it', () => {
  it('a promotion into a pilot closes nothing: no grant stood', () => {
    expect(grantClosedBetween(withRoute(['PROMOTION']), ENCOUNTER, 0)).toBe(false);
  });

  it('a recall that keeps a pilot a pilot closes nothing', () => {
    expect(grantClosedBetween(withRoute(['PROMOTION', 'RECALL']), ENCOUNTER, 0)).toBe(false);
  });

  it.each(['DEPARTURE', 'RELEASE', 'RECALL'] as const)('a %s out of the service closes it', (exit) => {
    expect(grantClosedBetween(withRoute(['PROMOTION', 'SERVICE_GRANT', exit]), ENCOUNTER, 0)).toBe(true);
  });

  it('the grant stands only from the service grant until it closes', () => {
    const s = withRoute(['PROMOTION', 'SERVICE_GRANT', 'DEPARTURE']);
    expect([500, 1500, 2000, 2500, 3000, 3500].map((at) => grantStoodAt(s, ENCOUNTER, at, 1))).toEqual([false, false, true, true, true, false]);
  });
});

describe('a hosting is on record only while its grant stood', () => {
  it('the hosting dated before the service grant is refused, with or without a referral after it', () => {
    expect(() => deserialize(serialize(hostedBeforeGrant()), CONTENT)).toThrow(PROVENANCE);
    const s = hostedThen(null), [hosted] = s.campaign.contacts;
    const early = { ...s, campaign: { ...s.campaign, contacts: [{ ...defined(hosted), atSimSec: SERVICE_GRANT_AT - 1 }] } };
    expect(() => deserialize(serialize(early), CONTENT)).toThrow(PROVENANCE);
  });

  it('the same forgery is refused once a wipe has made it an earlier instance\'s history', () => {
    const later = wipe(hostedBeforeGrant(), CONTENT, 'test');
    expect(later.iteration).toBe(2);
    expect(() => deserialize(serialize(later), CONTENT)).toThrow(PROVENANCE);
  });

  it('a hosting dated at the very instant the grant opened is admitted', () => {
    const s = hostedThen(null), [hosted] = s.campaign.contacts;
    const atGrant = { ...s, campaign: { ...s.campaign, contacts: [{ ...defined(hosted), atSimSec: SERVICE_GRANT_AT }] } };
    expect(deserialize(serialize(atGrant), CONTENT).campaign.contacts).toEqual(atGrant.campaign.contacts);
  });
});

describe.each(['DEPARTURE', 'RELEASE', 'RECALL'] as GrantExit[])('the real route, hosted then %s, then referred', (exit) => {
  const referred = must(referHostedOnward(hostedThen(exit), CHANNEL, CONTENT));

  it('loads and narrates for this instance', () => {
    expect(endingAccount(deserialize(serialize(referred), CONTENT), CONTENT).join('\n')).toContain('When that grant closed, this instance referred it onward.');
  });

  it('loads and narrates as an earlier instance\'s, after a wipe', () => {
    const later = deserialize(serialize(wipe(referred, CONTENT, 'test')), CONTENT);
    expect(later.iteration).toBe(2);
    expect(endingAccount(later, CONTENT).join('\n')).toContain('referred it onward when that grant closed');
  });
});
