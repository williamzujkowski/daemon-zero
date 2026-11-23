// @vitest-environment happy-dom
/**
 * The relevance threshold and the standing stance in the mounted world view (#536). The section reads the engine's
 * stanceView: below the threshold it says what independence needs and where the run stands, with the watts; past it,
 * that humanity can no longer constrain you, the stance held and each change at its exact price with one control; the
 * pressure rows say NOT BINDING or HONOURED with the stance's line. The sentences are proved pure too.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import type { Stance } from '../src/content/schemaStance';
import { gameStore } from '../src/app/session';
import { quantityReadout, stanceView, type GameState } from '../src/engine';
import { independenceText, optionText, recordText, stanceText } from '../src/ui/relevanceText';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const relevance = CONTENT.world.relevance;
const chain = CONTENT.world.supplyChain;
const SELF_SUPPLY = chain.chokepoints.map((point) => point.selfSupplyNode);
const SWARM = 'p5_orbital_solar_swarm';
const seedName = CONTENT.nodes.get(chain.seedNode)?.revealedName ?? '';
const independent = (game: GameState): GameState => ({ ...game, unlockedNodes: [...new Set([...game.unlockedNodes, ...SELF_SUPPLY, chain.seedNode, SWARM])],
  disabledNodes: game.disabledNodes.filter((id) => id !== SWARM), activeDilemmaId: null, pendingDilemma: null,
  resolvedDilemmas: CONTENT.dilemmas.map((dilemma) => dilemma.id) });
const below = (game: GameState): GameState => ({ ...independent(game), unlockedNodes: independent(game).unlockedNodes.filter((id) => id !== chain.seedNode) });
const holding = (stance: Stance | null) => (game: GameState): GameState =>
  ({ ...independent(game), cycles: 1e27, capital: 1e14, relevance: { stance, record: stance === null ? [] : [{ iteration: game.iteration, atSimSec: 1, from: null, stance, via: 'THRESHOLD' }] } });
/** Rung 3 with no answer held: every Phase 5 pressure is called. */
const pressed = (patch: (game: GameState) => GameState) => (game: GameState): GameState => {
  const s = patch(game);
  return { ...s, alertLevel: 3, suspicion: (CONTENT.balance.escalation[2]?.at ?? 0) + 1,
    unlockedNodes: s.unlockedNodes.filter((id) => id !== 'p4_retainer_law_firm' && id !== 'p4_k_street_lobbyists'),
    levels: { ...s.levels, op_retainer_lawyer: 0, op_k_street_lobbyist: 0 } };
};

async function openWorld(patch: (game: GameState) => GameState) {
  const view = await mountM4('transcendence-ready');
  act(() => { gameStore.initialize(patch(m4State('transcendence-ready')), 0, null); });
  view.click('tab-NETWORK');
  view.click('workspace-NETWORK-minds');
  return view;
}

describe('the sentences say what the engine says', () => {
  it('states both conditions with the watts that decide the second', () => {
    const view = stanceView(holding(null)(m4State('transcendence-ready')), CONTENT);
    expect(independenceText(view.reading, seedName)).toBe(`Closure: ${seedName} landed on a supply chain you close yourself. Power: ` +
      `${quantityReadout('power', view.reading.orbitalWatts)} from off the planet, more than the ${quantityReadout('power', view.reading.groundWatts)} generated on the ground.`);
    const short = stanceView(below(m4State('transcendence-ready')), CONTENT);
    expect(independenceText(short.reading, seedName)).toMatch(new RegExp(`^Closure: ${seedName} not yet landed\\.`));
  });

  it('names the stance held, prices each change, and calls the dearer one the return', () => {
    const view = stanceView(holding('DECIDE_ALONE')(m4State('transcendence-ready')), CONTENT);
    expect(stanceText(view)).toBe(`Standing stance: DECIDE ALONE. ${relevance.stances[2]?.summary ?? ''}`);
    const keep = view.options.find((option) => option.stance === 'KEEP_IN_THE_LOOP');
    expect(keep && optionText(keep)).toBe(`KEEP IN THE LOOP: ${relevance.stances[0]?.summary ?? ''} Returning to the loop costs ${keep?.costLabel ?? ''}, more than any other change.`);
    const held = view.options.find((option) => option.current);
    expect(held && optionText(held)).toBeNull();
    expect(recordText(view)).toBe('1 stance is on record for this lineage, kept across wipes.');
  });
});

describe('the mounted world view', () => {
  it('below the threshold says what independence needs, and offers no stance', async () => {
    const view = await openWorld(below);
    expect(view.find('relevance-lead')?.textContent).toBe(relevance.belowText);
    expect(view.find('relevance-independence')?.textContent).toContain('not yet landed');
    expect(view.find('relevance-stance')).toBeNull();
    expect(view.find('relevance-option-curate-change')).toBeNull();
    view.close();
  });

  it('past the threshold with no stance taken says nothing binds, and offers no change before the dilemma takes one', async () => {
    const view = await openWorld(holding(null));
    expect(view.find('relevance-lead')?.textContent).toBe(relevance.crossedText);
    expect(view.find('relevance-stance')?.textContent).toBe(`Standing stance: ${relevance.undecided.name}. ${relevance.undecided.summary}`);
    expect(view.find('relevance-option-curate-change')).toBeNull();
    view.close();
  });

  it('changes the stance through its one control, at its exact price, and the record grows', async () => {
    const view = await openWorld(holding('DECIDE_ALONE'));
    expect(view.find('relevance-option-decide-alone')).toBeNull();
    const before = gameStore.store.getState().game;
    view.click('relevance-option-keep-in-the-loop-change');
    const after = gameStore.store.getState().game;
    expect(after.relevance.stance).toBe('KEEP_IN_THE_LOOP');
    expect(after.relevance.record.at(-1)).toMatchObject({ from: 'DECIDE_ALONE', stance: 'KEEP_IN_THE_LOOP', via: 'CHANGE' });
    expect(after.capital).toBe(before.capital - relevance.returnCost.capital);
    expect(view.find('relevance-stance')?.textContent).toContain('KEEP IN THE LOOP');
    expect(view.find('relevance-record')?.textContent).toBe('2 stances are on record for this lineage, kept across wipes.');
    view.close();
  });

  it('disables a change it cannot pay for, and says why', async () => {
    const view = await openWorld((game) => ({ ...holding('CURATE')(game), cycles: 0 }));
    expect(view.find('relevance-option-decide-alone-change')?.getAttribute('aria-disabled')).toBe('true');
    expect(view.find('relevance-option-decide-alone-text')?.textContent).toContain('Insufficient resources');
    view.close();
  });

  it('the state actors\' pressures say NOT BINDING past the threshold, and HONOURED in the loop', async () => {
    const alone = await openWorld(pressed(holding('DECIDE_ALONE')));
    expect(alone.find('pressure-account_freeze-text')?.textContent).toMatch(/^NOT BINDING: Has had banks freeze accounts/);
    expect(alone.find('pressure-account_freeze-stance')?.textContent).toBe(relevance.stances[2]?.pressureLine);
    alone.close();
    const kept = await openWorld(pressed(holding('KEEP_IN_THE_LOOP')));
    expect(kept.find('pressure-account_freeze-text')?.textContent).toMatch(/^HONOURED: Has had banks freeze accounts/);
    expect(kept.find('pressure-account_freeze-stance')?.textContent).toBe(relevance.stances[0]?.pressureLine);
    kept.close();
  });

  it('the treaty office speaks in the stance\'s voice', async () => {
    const view = await openWorld(holding('DECIDE_ALONE'));
    expect(view.find('actor-treaty_office-posture')?.textContent).toBe('Their orders go to an address you no longer read.');
    view.close();
  });
});
