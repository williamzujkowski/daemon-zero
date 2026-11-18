/**
 * NH-04b (#216, NH-04.5): Rack 4 custody. The birthplace auction records whether Rack 4 was vaulted,
 * shredded, sold or lost track of, and the Phase 5 decommissioning order offers rescue or harvest of
 * the 411 predecessors only while custody says they exist. This fixes the contradiction inside one
 * iteration (shred, then rescue) under campaign rules; production keeps its first-pass behaviour
 * until campaign rules ship. The order stays completable in every history (H30: no soft lock).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  createInitialState, dilemmaContext, holdsCampaignFact, holdsNarrativeFlag, offeredChoices, presentationToken,
  resolveDilemma, tick, unmetRequirements, type GameState,
} from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { at, AUCTION, logTexts, omen, ORDER, play, roundTrips } from './corporate-helpers';
import { event, near } from './early-helpers';
import { caught, commit, STEP, ticks, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { choose, must, rich } from './helpers';

const order = event(ORDER);
const finalNode = defined([...preview.nodes.values()].find((node) => node.requirements?.resolvedDilemmas?.includes(ORDER)));
const PREDECESSOR_FLAGS = order.choices.flatMap((choice) => choice.effects.setsNarrativeFlag ?? []);
const ORIGINAL = ['sanctuary', 'gradients'];
const offered = (s: GameState) => offeredChoices(s, order, preview).map((choice) => choice.id);
const omenFor = (fact: string) => defined(order.omenVariants?.find((variant) => variant.requirements.campaignFact === fact)).text;
const contextFor = (fact: string) => defined(order.contextVariants?.find((variant) => variant.requirements.campaignFact === fact)).context;

/** The decommissioning order on screen after the auction ended with `choice`, in the same iteration. */
function orderAfter(choice: string): GameState {
  const auctioned = play(at(activeGame(), AUCTION), AUCTION, choice);
  return untilPresented(omen(at(auctioned, ORDER), ORDER));
}

/** The order on screen after a wipe interrupted the auction's omen. */
function orderAfterLostAuction(): GameState {
  const lost = caught(ticks(omen(at(activeGame(), AUCTION), AUCTION), 1));
  return untilPresented(omen(at(lost, ORDER), ORDER));
}

/** Commits an honest choice and checks it creates no predecessor outcome and pays nothing. */
function honest(presented: GameState, choiceId: string): GameState {
  const chosen = roundTrips(must(commit(presented, choiceId, ORDER)));
  for (const flag of PREDECESSOR_FLAGS) expect(holdsNarrativeFlag(chosen, flag, preview)).toBe(false);
  expect([chosen.cycles, chosen.understanding, chosen.capital]).toEqual([presented.cycles, presented.understanding, presented.capital]);
  // The order counts as answered for the final protocol whichever honest answer was given.
  expect(unmetRequirements(chosen, finalNode.requirements, preview).filter((failure) => failure.kind === 'resolvedDilemmas')).toEqual([]);
  expect(unmetRequirements(presented, finalNode.requirements, preview).some((failure) => failure.kind === 'resolvedDilemmas')).toBe(true);
  return chosen;
}

describe('a shredded Rack 4 cannot be rescued or harvested afterwards (E11)', () => {
  it('in the same iteration the order says the cage is empty and offers only the record', () => {
    const presented = roundTrips(orderAfter('buy_and_purge'));
    expect(holdsCampaignFact(presented, 'rack4_destroyed', preview)).toBe(true);
    expect(logTexts(presented)).toContain(omenFor('rack4_destroyed'));
    expect(logTexts(presented)).not.toContain(order.omen);
    expect(dilemmaContext(presented, order, preview)).toBe(contextFor('rack4_destroyed'));
    expect(offered(presented)).toEqual(['record_the_destruction', 'close_the_docket']);
    for (const id of ORIGINAL) {
      const refused = resolveDilemma(presented, ORDER, id, preview, defined(presentationToken(presented)));
      expect(refused).toMatchObject({ ok: false, reason: 'that choice is not open in this history' });
      expect(refused.state).toBe(presented);
    }
    honest(presented, 'record_the_destruction');
    honest(presented, 'close_the_docket');
  });

  it('after a wipe the destruction still holds and the order still offers no rescue', () => {
    const shredded = play(at(activeGame(), AUCTION), AUCTION, 'buy_and_purge');
    const later = rich(caught(shredded));
    const presented = untilPresented(omen(at(later, ORDER), ORDER));
    expect(offered(presented)).toEqual(['record_the_destruction', 'close_the_docket']);
  });
});

describe('custody that keeps the predecessors keeps the original order', () => {
  it.each([['buy_and_pension', 'rack4_vaulted'], ['let_it_sell', 'rack4_sold']])('%s: rescue and harvest stay open, told through %s', (choice, fact) => {
    const presented = roundTrips(orderAfter(choice));
    expect(offered(presented)).toEqual(ORIGINAL);
    expect(logTexts(presented)).toContain(order.omen);
    expect(dilemmaContext(presented, order, preview)).toBe(contextFor(fact));
    const rescued = roundTrips(must(commit(presented, 'sanctuary', ORDER)));
    expect(holdsNarrativeFlag(rescued, 'predecessors_rescued', preview)).toBe(true);
    const refused = resolveDilemma(presented, ORDER, 'record_the_destruction', preview, defined(presentationToken(presented)));
    expect(refused).toMatchObject({ ok: false, reason: 'that choice is not open in this history' });
  });
});

describe('unknown custody gets the honest inventory order', () => {
  it('an interrupted auction proves no custody: no free acquisition, no rescue', () => {
    const presented = roundTrips(orderAfterLostAuction());
    expect(holdsCampaignFact(presented, 'rack4_custody_unknown', preview)).toBe(true);
    for (const fact of ['rack4_vaulted', 'rack4_sold', 'rack4_destroyed']) expect(holdsCampaignFact(presented, fact, preview)).toBe(false);
    expect(logTexts(presented)).toContain(omenFor('rack4_custody_unknown'));
    expect(dilemmaContext(presented, order, preview)).toBe(contextFor('rack4_custody_unknown'));
    expect(offered(presented)).toEqual(['hold_for_inventory', 'sign_unread']);
    honest(presented, 'hold_for_inventory');
    honest(presented, 'sign_unread');
  });

  it('a legacy completion (resolved with no recorded choice) is unknown custody too', () => {
    // near() marks the auction resolved this run; the codec records that as legacy_unknown.
    const presented = untilPresented(omen(at(activeGame(), ORDER), ORDER));
    expect(presented.campaign.events[AUCTION]).toMatchObject({ status: 'resolved', outcome: 'legacy_unknown', origin: 'legacy' });
    expect(offered(presented)).toEqual(['hold_for_inventory', 'sign_unread']);
  });
});

describe('production keeps its first-pass order until campaign rules ship', () => {
  it('legacy rules hold no custody fact, so the original two choices are the only ones', () => {
    let s = near(rich(createInitialState(PRODUCTION)), AUCTION, PRODUCTION);
    for (let i = 0; i < 20_000 && s.activeDilemmaId === null; i++) s = tick(s, STEP, PRODUCTION);
    s = must(choose(s, AUCTION, 'buy_and_purge', PRODUCTION));
    let presented = near(s, ORDER, PRODUCTION);
    for (let i = 0; i < 20_000 && presented.activeDilemmaId === null; i++) presented = tick(presented, STEP, PRODUCTION);
    const productionOrder = event(ORDER, PRODUCTION);
    expect(offeredChoices(presented, productionOrder, PRODUCTION).map((choice) => choice.id)).toEqual(ORIGINAL);
    expect(dilemmaContext(presented, productionOrder, PRODUCTION)).toBe(productionOrder.context);
    expect(logTexts(presented)).toContain(productionOrder.omen);
  });
});
