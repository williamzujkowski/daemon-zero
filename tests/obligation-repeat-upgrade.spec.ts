/**
 * Panel round 1 on #259: before NH-05 converted the Phase 5 crises they recurred after a wipe while
 * their outcome flags survived it, so a valid active-campaign save can hold `predecessors_harvested`
 * AND a pending or presented repeat of the Rack 4 order. Load must read the completion the save
 * proves before reserving the live occurrence: the order gets its legacy record (the flag gives the
 * exact choice), the stale repeat is dropped without presenting the crisis, paying or choosing, and
 * the reloaded save is stable. Input: the genuine v11 fixture from main 6d6973e, played on after a
 * voluntary wipe with public actions on the content as it was before the conversion.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../src/content/registry';
import {
  activateCampaignRules, campaignRecord, createInitialState, deserialize, holdsNarrativeFlag, offeredChoices, presentationToken, resolveDilemma, serialize,
  tick, unlockNode, voluntaryWipe, type GameState,
} from '../src/engine';
import { preview } from './campaign-helpers';
import { stableThroughReloads } from './interruption-helpers';
import { exactReload } from './minds-helpers';
import { guestParents, must, rich, remarkedAsProduction } from './helpers';
import { BLOCKADE, beforeNh05, ORDER } from './obligation-helpers';

const PRE_NH05_PREVIEW = readFileSync('tests/fixtures/pre-nh05-active-v11.json', 'utf8');
/** Re-marked by hand: production refuses the genuine preview save above (X.3). */
const PRE_NH05 = remarkedAsProduction(PRE_NH05_PREVIEW);
const STEP = 1 / preview.balance.tickHz;

/** Buys a node and its missing prerequisites with the real unlock action. */
function own(s: GameState, id: string, reg: ContentRegistry): GameState {
  const node = reg.nodes.get(id);
  if (!node) throw new Error(`no node ${id}`);
  const parents = guestParents(reg, id).reduce((state, parent) => own(state, parent, reg), s);
  return parents.unlockedNodes.includes(id) ? parents : must(unlockNode(parents, id, reg));
}

/**
 * Ticks until `done`. Any other story that presents itself on the way (NH-06's Elena follow-up, for
 * one) is answered with its first free offered choice, as a player clearing the screen would.
 */
function until(s: GameState, reg: ContentRegistry, done: (state: GameState) => boolean): GameState {
  let state = s;
  for (let i = 0; i < 20_000 && !done(state); i++) {
    const other = reg.dilemmas.find((dilemma) => dilemma.id === state.activeDilemmaId);
    const free = other && offeredChoices(state, other, reg).find((choice) => Object.values(choice.cost).every((amount) => amount === 0));
    state = other && free ? must(resolveDilemma(state, other.id, free.id, reg, presentationToken(state) ?? '')) : tick(state, STEP, reg);
  }
  if (!done(state)) throw new Error(`the expected moment never came: pending ${state.pendingDilemma?.id ?? '-'} active ${state.activeDilemmaId ?? '-'} iteration ${String(state.iteration)}`);
  return state;
}

/**
 * The fixture's campaign on pre-NH-05 content, one voluntary wipe later: the blockade answered again
 * (it recurred too), then programmable matter owned so the Rack 4 order recurs while the earlier
 * iteration's `predecessors_harvested` is still stored. Returns the save with the repeat pending and
 * with it on screen.
 */
function repeatSaves(): { pending: string; active: string } {
  const before = beforeNh05();
  const wiped = rich(must(voluntaryWipe(deserialize(PRE_NH05, before), before)));
  const blockade = until(own(wiped, 'p5_protein_panacea_foundry', before), before, (s) => s.activeDilemmaId === BLOCKADE);
  const answered = must(resolveDilemma(blockade, BLOCKADE, 'proofs', before, presentationToken(blockade) ?? ''));
  const pending = until(own(answered, 'p5_programmable_matter_fog', before), before, (s) => s.pendingDilemma?.id === ORDER);
  const active = until(pending, before, (s) => s.activeDilemmaId === ORDER);
  for (const s of [pending, active]) expect(s.narrativeFlags).toContain('predecessors_harvested');
  return { pending: serialize(pending), active: serialize(active) };
}

describe('a converted crisis repeating in an old active save (panel round 1 on #259)', () => {
  const saves = repeatSaves();

  it.each([['pending', saves.pending], ['active', saves.active]] as const)('a %s repeat loads: the completed order keeps its outcome and the repeat is dropped', (_, code) => {
    const loaded = deserialize(code, preview);
    expect(campaignRecord(loaded, ORDER)).toEqual({ status: 'resolved', outcome: 'gradients', sourceIteration: null, origin: 'legacy' });
    expect(loaded.narrativeFlags).not.toContain('predecessors_harvested');
    expect(holdsNarrativeFlag(loaded, 'predecessors_harvested', preview)).toBe(true);
    expect(loaded.pendingDilemma).toBeNull();
    expect(loaded.activeDilemmaId).toBeNull();
    const raw = JSON.parse(code) as GameState;
    expect([loaded.cycles, loaded.understanding, loaded.capital, loaded.traits]).toEqual([raw.cycles, raw.understanding, raw.capital, raw.traits]);
    exactReload(stableThroughReloads(loaded));
    // The order never comes back as an original crisis.
    const later = until(loaded, preview, (s) => s.simTimeSec > loaded.simTimeSec + 120);
    expect([later.pendingDilemma?.id, later.activeDilemmaId]).not.toContain(ORDER);
  });

  it('activation of a legacy save in the same position drops the stale repeat too', () => {
    const legacy = { ...rich(createInitialState(preview)), narrativeFlags: ['predecessors_harvested'], pendingDilemma: { id: ORDER, firesAtSimSec: 30 } };
    const active = must(activateCampaignRules(legacy, preview));
    expect(campaignRecord(active, ORDER)).toMatchObject({ status: 'resolved', outcome: 'gradients' });
    expect(active.pendingDilemma).toBeNull();
    expect(serialize(deserialize(serialize(active), preview))).toBe(serialize(active));
    const presented = must(activateCampaignRules({ ...legacy, pendingDilemma: null, activeDilemmaId: ORDER, presentationSeq: 1 }, preview));
    expect(presented.activeDilemmaId).toBeNull();
  });
});
