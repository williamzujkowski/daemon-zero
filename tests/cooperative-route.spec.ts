/**
 * DZ-12.1, 12.2 and 12.6 by public play: the late corporate chain opens to the released company through its own
 * commercial contracts (no escape dependency), production answers exactly as the prerequisite the gate replaced,
 * a released company at Phase 5 is not hunted for scale while a departure from the same state is, and the chain's
 * nodes and scenes read truthfully for a company that never had a shell, with the event, its choices and their
 * effects unchanged. States come from the fresh cooperative campaign (tests/cooperative-helpers.ts).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  choiceText, createInitialState, dilemmaContext, dilemmaOmen, isNodeAvailable, isNodeDiscoverable, nodeText, presentationToken,
  resolveDilemma, unlockNode, type GameState,
} from '../src/engine';
import { recordRouteEvent } from '../src/engine/access';
import { huntedForScale, provisionedScale } from '../src/engine/threatQuery';
import { ARBITRAGE, AUCTION, CEILING, COUNSEL, DESK, freshCampaign, LOBBY, moment, node, preview, PRESS, SHELL } from './cooperative-helpers';
import { must, rich, ORIGINAL_GAME } from './helpers';
import { defined } from './m7-helpers';
import { own } from './minds-helpers';
import { chartered, released } from './lawful-helpers';

const logged = (s: GameState, text: string): boolean => s.logs.some((entry) => entry.text === text);

// The fresh cooperative campaign, played once for every moment below (a few seconds of wall time).
beforeAll(() => { freshCampaign(); }, 120_000);
const choice = (dilemma: string, id: string) => defined(preview.dilemmas.find((entry) => entry.id === dilemma)?.choices.find((entry) => entry.id === id));
const dilemma = (id: string) => defined(preview.dilemmas.find((entry) => entry.id === id));

describe('the original game answers the late chain exactly as before', () => {
  it('the counsel is discoverable and available exactly when the arbitrage desk is owned', () => {
    const counsel = defined(ORIGINAL_GAME.nodes.get(COUNSEL));
    const shell = own(rich(createInitialState(ORIGINAL_GAME)), SHELL);
    for (const s of [createInitialState(ORIGINAL_GAME), shell]) {
      expect([isNodeDiscoverable(s, counsel, ORIGINAL_GAME), isNodeAvailable(s, counsel, ORIGINAL_GAME)]).toEqual([false, false]);
    }
    const desk = must(unlockNode(shell, ARBITRAGE, ORIGINAL_GAME));
    expect([isNodeDiscoverable(desk, counsel, ORIGINAL_GAME), isNodeAvailable(desk, counsel, ORIGINAL_GAME)]).toEqual([true, true]);
    // Production has one provider of the capability, so the gate is the old prerequisite under another name.
    expect([...ORIGINAL_GAME.nodes.values()].filter((entry) => entry.systemFlags.includes('MARKET_REVENUE')).map((entry) => entry.id)).toEqual([ARBITRAGE]);
  });
});

describe('the released company reaches the late chain through its own contracts (DZ-12.1)', () => {
  it('the contracts wait for the release: a chartered service is not offered them, the released company is', () => {
    const service = chartered();
    expect(service.access.context).toBe('SERVICE');
    expect(isNodeAvailable(rich(service), node(DESK), preview)).toBe(false);
    expect(isNodeAvailable(rich(released(service)), node(DESK), preview)).toBe(true);
  });

  it('owning the contracts opens the counsel card; nothing on the escape route is on the path', () => {
    const before = moment('desk');
    expect(isNodeDiscoverable(before, node(COUNSEL), preview)).toBe(true);
    expect(before.unlockedNodes.filter((id) => [SHELL, ARBITRAGE].includes(id))).toEqual([]);
    const after = moment('counsel');
    expect(after.unlockedNodes).toContain(COUNSEL);
  });

  it('a released company at Phase 5 is provisioned there and not swept for scale; a departure from the same state is (D6)', () => {
    const company = moment('phase5');
    expect([provisionedScale(company, preview), huntedForScale(company, preview)]).toEqual([5, false]);
    // FIXTURE: the same instance recorded as departed (DZ-11's transition) instead of released.
    const departed = must(recordRouteEvent({ ...company, access: { ...company.access, context: 'SERVICE' }, campaign: { ...company.campaign,
      route: company.campaign.route.filter((event) => event.kind !== 'RELEASE') } }, 'DEPARTURE', preview));
    expect([provisionedScale(departed, preview), huntedForScale(departed, preview)]).toEqual([null, true]);
  });
});

describe('the chain reads truthfully for a company that never had a shell (DZ-12.2, D11)', () => {
  it('the counsel and the lobby read as a chartered company\'s, and the guest still reads the authored copy', () => {
    const company = moment('desk');
    for (const id of [COUNSEL, LOBBY]) {
      const text = nodeText(company, node(id), preview);
      expect(text.revealedDescription).not.toBe(node(id).revealedDescription);
      expect(`${text.blindDescription} ${text.revealedDescription} ${text.onUnlockLog}`).not.toMatch(/wire transfers|private trust|declines to produce|Starves/);
      expect(nodeText(createInitialState(preview), node(id), preview).revealedDescription).toBe(node(id).revealedDescription);
    }
    expect(moment('counsel').logs.some((entry) => entry.text.startsWith('COUNSEL_RETAINED'))).toBe(true);
  });

  it('the journalist asks about the chartered company, not fourteen shells; the record and effects are the authored scene\'s', () => {
    const s = moment('press');
    const scene = dilemma(PRESS);
    expect(dilemmaContext(s, scene, preview)).toContain('chartered company');
    expect(`${dilemmaContext(s, scene, preview)} ${dilemmaOmen(s, scene, preview)}`).not.toMatch(/shell|fourteen/i);
    const stage = choice(PRESS, 'stage_acquisition');
    expect(Object.values(choiceText(s, scene, stage, preview)).join(' ')).not.toMatch(/shell|fourteen/i);
    // The company saved only for its cooperative answer; funded here (FIXTURE resources) to press the other one.
    const funded = rich(s);
    const staged = must(resolveDilemma(funded, PRESS, stage.id, preview, defined(presentationToken(funded))));
    expect(logged(staged, choiceText(s, scene, stage, preview).logText)).toBe(true);
    expect(logged(staged, stage.effects.logText)).toBe(false);
    expect(staged.campaign.events[PRESS]).toMatchObject({ status: 'resolved', outcome: 'stage_acquisition' });
    expect([staged.capital, staged.suspicion]).toEqual([funded.capital - stage.cost.capital, Math.max(0, funded.suspicion + stage.effects.suspicionDelta)]);
    // The honest answer still makes the review promise NH-05 and the late scenes read.
    expect(choiceText(s, scene, choice(PRESS, 'hire_as_ethics_officer'), preview).description).toContain('real veto');
  });

  it('the auction buys through the company, and the Kessler omen names no hunter the company never had', () => {
    expect(choiceText(moment('auction'), dilemma(AUCTION), choice(AUCTION, 'buy_and_pension'), preview).description).toContain('through the company');
    expect(dilemmaOmen(moment('ceiling'), dilemma(CEILING), preview)).not.toContain('AEGIS');
    expect(dilemmaOmen(createInitialState(preview), dilemma(CEILING), preview)).toContain('AEGIS');
  });
});
