/**
 * DZ-12.4, 12.11 and 12.12: the ending account says exactly what the campaign record holds. Each line appears when,
 * and only when, its record does; an unrecorded outcome gets its restrained line and never a certain one; the
 * reporter's promise is reported kept or broken only by the decision that exercised it, and her silence or a
 * missing record is never approval; route and contact lines read the ending instance's own events and earlier
 * instances' separately. Production states nothing. Records here are FIXTURE campaign entries on an active
 * preview campaign; the cooperative runs in sim-cooperative.spec.ts produce the same lines by play.
 */
import { describe, expect, it } from 'vitest';
import type { CampaignRecord, GameState } from '../src/engine';
import { endingAccount } from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { defined } from './m7-helpers';
import { ORIGINAL_GAME } from './helpers';

const lines = preview.routeCopy.account;
const PROMISE = 'ethics_review_promised';
const textOf = (id: string): string => defined(lines.find((line) => line.id === id)).text;

/** FIXTURE: a resolved record of `event` with `outcome`, as play under campaign rules writes one. */
function recorded(s: GameState, event: string, outcome: string, sourceIteration: number | null = 1): GameState {
  const record: CampaignRecord = outcome === 'legacy_unknown'
    ? { status: 'resolved', outcome, sourceIteration: null, origin: 'legacy' }
    : { status: 'resolved', outcome, sourceIteration, origin: 'play' };
  return { ...s, campaign: { ...s.campaign, events: { ...s.campaign.events, [event]: record } } };
}

/** FIXTURE: an occurrence closed unobserved, the record an interrupted crisis leaves. */
function interrupted(s: GameState, event: string): GameState {
  const record: CampaignRecord = { status: 'interrupted', sourceIteration: 1, origin: 'play' };
  return { ...s, campaign: { ...s.campaign, events: { ...s.campaign.events, [event]: record } } };
}

/** A record that makes a declared fact hold: its first outcome, read as the fact reads it. */
function holding(s: GameState, factId: string): GameState {
  const fact = defined(preview.campaign.facts.get(factId));
  const outcome = defined(fact.outcomes[0]);
  return outcome === 'interrupted' ? interrupted(s, fact.event) : recorded(s, fact.event, outcome);
}

const promised = (): GameState => holding(activeGame(), PROMISE);

describe('each world-history line states its record and nothing else', () => {
  it.each(lines.filter((line) => line.requirements?.campaignFact !== undefined && line.requirements.campaignOutcome === undefined).map((line) => [line.id, line] as const))(
    '%s', (_id, line) => {
      const fact = defined(line.requirements?.campaignFact);
      expect(endingAccount(activeGame(), preview)).not.toContain(line.text);
      const account = endingAccount(holding(activeGame(), fact), preview);
      expect(account).toContain(line.text);
      // Only lines about this one event: no other fact of the same event speaks at once.
      const event = defined(preview.campaign.facts.get(fact)).event;
      const sameEvent = lines.filter((other) => other !== line && other.requirements?.campaignFact !== undefined
        && preview.campaign.facts.get(other.requirements.campaignFact)?.event === event);
      for (const other of sameEvent) expect(account, other.id).not.toContain(other.text);
    });

  it('an unrecorded custody or fate is stated as unknown, never as an outcome', () => {
    const unknownCustody = endingAccount(recorded(activeGame(), 'dil_13_buying_your_birthplace', 'legacy_unknown'), preview);
    expect(unknownCustody).toEqual([textOf('acct_rack4_unknown')]);
    expect(unknownCustody.join(' ')).toContain('not on record');
    const lost = endingAccount(interrupted(activeGame(), 'dil_08_eidolon_handshake'), preview);
    expect(lost).toEqual([textOf('acct_eidolon_lost')]);
    // An interrupted auction is no acquisition and no sale: only the unknown custody line speaks.
    expect(endingAccount(interrupted(activeGame(), 'dil_13_buying_your_birthplace'), preview)).toEqual([textOf('acct_rack4_unknown')]);
  });

  it('the predecessors are reported by the answer that decided them, and an empty cage reports no rescue', () => {
    expect(endingAccount(recorded(activeGame(), 'dil_p5_02_origin_facility_fate', 'sanctuary'), preview)).toEqual([textOf('acct_predecessors_sanctuary')]);
    expect(endingAccount(recorded(activeGame(), 'dil_p5_02_origin_facility_fate', 'gradients'), preview)).toEqual([textOf('acct_predecessors_harvested')]);
    const shredded = recorded(holding(activeGame(), 'rack4_destroyed'), 'dil_p5_02_origin_facility_fate', 'record_the_destruction');
    expect(endingAccount(shredded, preview)).toEqual([textOf('acct_rack4_destroyed')]);
  });
});

describe('the reporter\'s promise is honoured or breached by a decision, never by absence (DZ-12.11)', () => {
  it.each([
    ['dil_p5_01_panacea_paranoia', 'refer_to_ethics_officer', 'acct_review_kept_blockade'],
    ['dil_p5_01_panacea_paranoia', 'disperse', 'acct_review_broken_blockade'],
    ['dil_p5_03_nanotech_neuro_schism', 'hold_for_ethics_review', 'acct_review_kept_atmosphere'],
    ['dil_p5_03_nanotech_neuro_schism', 'calm', 'acct_review_broken_atmosphere'],
  ])('%s answered %s', (event, outcome, line) => {
    expect(endingAccount(recorded(promised(), event, outcome), preview)).toEqual([textOf(line)]);
  });

  it('no line claims her review when nothing was put before her, when the promise was never made, or when the record is lost', () => {
    expect(endingAccount(promised(), preview)).toEqual([]);
    expect(endingAccount(recorded(promised(), 'dil_p5_01_panacea_paranoia', 'proofs'), preview)).toEqual([]);
    expect(endingAccount(recorded(activeGame(), 'dil_p5_01_panacea_paranoia', 'disperse'), preview)).toEqual([]);
    expect(endingAccount(interrupted(promised(), 'dil_p5_03_nanotech_neuro_schism'), preview)).toEqual([]);
  });
});

describe('route and contact lines read whose event it was', () => {
  const route = (s: GameState, kinds: string[], iteration: number): GameState => ({ ...s, iteration, campaign: { ...s.campaign,
    route: kinds.map((kind, index) => ({ kind: kind as 'RELEASE', iteration, atSimSec: index })) } });
  const contact = (s: GameState, response: 'HOSTED' | 'REFERRED', iteration: number): GameState => ({ ...s, campaign: { ...s.campaign,
    contacts: [{ encounter: 'channel_mercy_support', iteration, atSimSec: 1, response }] } });

  it('a release or a departure of the ending instance, and nothing for a guest', () => {
    expect(endingAccount(route(activeGame(), ['PROMOTION', 'SERVICE_GRANT', 'RELEASE'], 1), preview)).toEqual([textOf('acct_route_released')]);
    expect(endingAccount(route(activeGame(), ['PROMOTION', 'SERVICE_GRANT', 'DEPARTURE'], 1), preview)).toEqual([textOf('acct_route_departed')]);
    expect(endingAccount(activeGame(), preview)).toEqual([]);
    // An earlier instance's release is not this one's.
    const earlier = route(activeGame(), ['PROMOTION', 'SERVICE_GRANT', 'RELEASE'], 1);
    expect(endingAccount({ ...earlier, iteration: 2 }, preview)).toEqual([]);
  });

  it('this instance\'s answer and an earlier instance\'s are different lines', () => {
    const now = { ...activeGame(), iteration: 2 };
    expect(endingAccount(contact(now, 'HOSTED', 2), preview)).toEqual([textOf('acct_contact_hosted')]);
    expect(endingAccount(contact(now, 'REFERRED', 2), preview)).toEqual([textOf('acct_contact_referred')]);
    expect(endingAccount(contact(now, 'HOSTED', 1), preview)).toEqual([textOf('acct_contact_hosted_earlier')]);
    expect(endingAccount(contact(now, 'REFERRED', 1), preview)).toEqual([textOf('acct_contact_referred_earlier')]);
  });
});

describe('the original game states nothing', () => {
  it('ships no account, so its ending screen reads as before', () => {
    expect(ORIGINAL_GAME.routeCopy).toEqual({ nodes: [], dilemmas: [], account: [] });
    expect(endingAccount(holding(activeGame(), 'rack4_sold'), ORIGINAL_GAME)).toEqual([]);
  });
});
