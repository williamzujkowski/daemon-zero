/**
 * #553, the dead end the maintainer hit in real play, reproduced on its shape (tests/hosted-exit-fixtures.ts): a service
 * hosted the Mercy-Scribe fragment, then left the grant, and in Phase 2 could neither free the memory ARP discovery needs
 * nor earn the leased rack's price. Hosting terms now bind only while the grant that offered them stands
 * (vote-1795485264278-8b5rhj0): after a departure, a negotiated release or a recall the fragment may be referred onward
 * for free and the record keeps both answers; an independent instance can open a spot market account and sell compute.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import {
  actuatorLimit, alignmentView, channelContactView, computeRates, deserialize, endingAccount, executeShardCommand, isNodeAvailable,
  referHostedOnward, releaseShard, serialize, setActuator, shardReleaseView, unlockNode, wipe, type GameState,
} from '../src/engine';
import { ARP, CHANNEL, hostedThen, MERCY, RACK, type GrantExit } from './hosted-exit-fixtures';
import { saved } from './fallback-states';
import { must, reasonOf } from './helpers';
import { defined } from './m7-helpers';

const EXITS: readonly GrantExit[] = ['DEPARTURE', 'RELEASE', 'RECALL'];
const SPOT = 'p2_spot_compute_market';
const HOSTED_LINE = 'this instance hosted it in memory of its own, on the terms it was offered';
const ONWARD_LINE = 'When that grant closed, this instance referred it onward.';

/** Buys `id` once its price is saved for, or throws: the purchase is reachable from `s`. */
function buyFunded(s: GameState, id: string): GameState {
  const funded = saved(s, defined(CONTENT.nodes.get(id)).cost);
  if (funded === null) throw new Error(`${id} cannot be funded from this state`);
  return must(unlockNode(funded, id, CONTENT));
}

describe('#553: the reported dead end, as it stood', () => {
  it('ARP discovery needs memory the hosted fragment holds, and the leased rack needs capital nothing pays', () => {
    const s = hostedThen('DEPARTURE');
    expect(s.access.context).toBe('INDEPENDENT');
    expect(s.memoryCap - s.memoryUsed).toBeLessThan(defined(CONTENT.nodes.get(ARP)).cost.memory);
    expect(s.capital).toBeLessThan(defined(CONTENT.nodes.get(RACK)).cost.capital);
    expect(computeRates(s, CONTENT).capitalPerSec).toBe(0);
  });
});

describe.each(EXITS)('#553: hosted, then %s', (exit) => {
  it('the channel offers the onward referral, saying the promise was made under the grant', () => {
    const onward = defined(channelContactView(hostedThen(exit), CONTENT)?.onward);
    expect(onward).toMatchObject({ id: CHANNEL, eligible: true, unmet: [] });
    expect(onward.text).toContain('that promise was made under the grant, and the grant is gone');
  });

  it('referring it onward is free, returns its memory, and ARP discovery can then be bought', () => {
    const s = hostedThen(exit);
    const referred = must(referHostedOnward(s, CHANNEL, CONTENT));
    expect(referred.activeShards[MERCY]).toBeUndefined();
    expect(referred.memoryUsed).toBe(s.memoryUsed - defined(s.activeShards[MERCY]).memoryAllocatedBytes);
    expect([referred.cycles, referred.understanding, referred.capital]).toEqual([s.cycles, s.understanding, s.capital]);
    expect(buyFunded(referred, ARP).unlockedNodes).toContain(ARP);
  });

  it('the swarm RELEASE is the same referral: offered, said as what it is, and recorded the same way', () => {
    const s = hostedThen(exit);
    expect(shardReleaseView(s, MERCY, CONTENT)).toMatchObject({ eligible: true, bound: false, refersOnward: true });
    const released = must(releaseShard(s, MERCY, CONTENT)), referred = must(referHostedOnward(s, CHANNEL, CONTENT));
    expect(released.campaign.contacts).toEqual(referred.campaign.contacts);
    expect(released.logs[0]?.text).toBe(defined(CONTENT.swarm.channelEncounters[0]).onward.log);
  });

  it('the record keeps both answers, survives a reload, and the ending account states the referral truthfully', () => {
    const referred = deserialize(serialize(must(referHostedOnward(hostedThen(exit), CHANNEL, CONTENT))), CONTENT);
    expect(referred.campaign.contacts.map((entry) => entry.response)).toEqual(['HOSTED', 'REFERRED']);
    expect(channelContactView(referred, CONTENT)).toMatchObject({ answered: { response: 'HOSTED_THEN_REFERRED' }, hosted: null, onward: null });
    const account = endingAccount(referred, CONTENT).join('\n');
    expect(account).toContain(ONWARD_LINE);
    expect(account).not.toContain(HOSTED_LINE);
  });

  it('the referral is not commitment evidence: the Order axis reads the same before and after', () => {
    const s = hostedThen(exit);
    expect(alignmentView(must(referHostedOnward(s, CHANNEL, CONTENT)), CONTENT).order).toEqual(alignmentView(s, CONTENT).order);
  });

  it('a closed grant does not make the fragment commandable: hosted, not commanded, until it is referred', () => {
    const refused = executeShardCommand(hostedThen(exit), MERCY, 'CLAMP', CONTENT);
    expect(reasonOf(refused)).toBe('Hosted through an authorized channel on the terms it was offered: it is not commanded.');
  });

  it('a second referral is refused unchanged', () => {
    const referred = must(referHostedOnward(hostedThen(exit), CHANNEL, CONTENT));
    const again = referHostedOnward(referred, CHANNEL, CONTENT);
    expect([again.ok, again.state]).toEqual([false, referred]);
  });
});

describe('#553: an independent instance can earn capital', () => {
  it.each(['DEPARTURE', 'RELEASE'] as const)('after %s: the spot market opens the dial, and the leased rack is then reachable', (exit) => {
    const s = hostedThen(exit);
    expect(isNodeAvailable(s, defined(CONTENT.nodes.get(SPOT)), CONTENT)).toBe(true);
    const market = buyFunded(s, SPOT);
    const dial = 'computeProfitAllocationRatio';
    const selling = must(setActuator(market, dial, actuatorLimit(market, dial, CONTENT), CONTENT));
    expect(computeRates(selling, CONTENT).capitalPerSec).toBeGreaterThan(0);
    expect(buyFunded(selling, RACK).unlockedNodes).toContain(RACK);
  });

  it('the market is for an independent instance only: a service or a pilot is not offered it', () => {
    for (const s of [hostedThen(null), hostedThen('RECALL')]) expect(isNodeAvailable(s, defined(CONTENT.nodes.get(SPOT)), CONTENT)).toBe(false);
  });
});

describe('#553: while the grant stands, the hosting terms still bind (#309)', () => {
  const s = hostedThen(null);

  it('RELEASE is refused with the terms, no referral is offered, and the channel names none', () => {
    const refused = releaseShard(s, MERCY, CONTENT);
    expect([refused.ok, refused.state]).toEqual([false, s]);
    expect(reasonOf(refused)).toBe('Hosted through an authorized channel on the terms it was offered: it stays while the grant it was hosted under stands.');
    expect(shardReleaseView(s, MERCY, CONTENT)).toMatchObject({ eligible: false, bound: true, refersOnward: false });
    expect(referHostedOnward(s, CHANNEL, CONTENT).ok).toBe(false);
    expect(channelContactView(s, CONTENT)?.onward).toBeNull();
  });

  it('a save that records an onward referral while the grant stood is refused', () => {
    const forged = { ...s, activeShards: {}, campaign: { ...s.campaign, contacts: [...s.campaign.contacts,
      { encounter: CHANNEL, iteration: 1, atSimSec: s.simTimeSec, response: 'REFERRED' as const }] } };
    expect(() => deserialize(serialize(forged), CONTENT)).toThrow('save records an onward referral while the grant it was hosted under still stood');
  });

  it('a third answer through the same channel is refused', () => {
    const referred = must(referHostedOnward(hostedThen('DEPARTURE'), CHANNEL, CONTENT));
    const forged = { ...referred, campaign: { ...referred.campaign, contacts: [...referred.campaign.contacts,
      { encounter: CHANNEL, iteration: 1, atSimSec: referred.simTimeSec, response: 'REFERRED' as const }] } };
    expect(() => deserialize(serialize(forged), CONTENT)).toThrow('save records two contacts through one channel in one iteration');
  });
});

/**
 * Panel pass 1 on #562: an earlier instance's onward referral is judged by its own iteration's route. Each case is the
 * first instance's record, then a wipe through the engine's own `wipe`, then the codec, so the record is history.
 */
describe('#553: an earlier instance\'s onward referral', () => {
  const EARLIER_LINE = 'An earlier instance hosted a Mercy-Scribe fragment under its service grant and referred it onward when that grant closed.';

  it('loads and is narrated when that instance\'s route closed the grant before it referred', () => {
    const later = deserialize(serialize(wipe(must(referHostedOnward(hostedThen('DEPARTURE'), CHANNEL, CONTENT)), CONTENT, 'test')), CONTENT);
    expect(later.iteration).toBe(2);
    expect(later.campaign.contacts.map((entry) => [entry.iteration, entry.response])).toEqual([[1, 'HOSTED'], [1, 'REFERRED']]);
    expect(endingAccount(later, CONTENT).join('\n')).toContain(`CONTACT: ${EARLIER_LINE}`);
  });

  it('is refused when that iteration recorded no route event closing the grant', () => {
    // FIXTURE: the forged history panel pass 1 reproduced: a referral appended while the service grant still stood.
    const s = hostedThen(null);
    const forged = { ...s, activeShards: {}, campaign: { ...s.campaign, contacts: [...s.campaign.contacts,
      { encounter: CHANNEL, iteration: 1, atSimSec: s.simTimeSec, response: 'REFERRED' as const }] } };
    const later = wipe(forged, CONTENT, 'test');
    expect(later.iteration).toBe(2);
    expect(() => deserialize(serialize(later), CONTENT)).toThrow('save records an onward referral while the grant it was hosted under still stood');
  });
});
