/**
 * Prices carried into a later phase (#494, src/content/phasePrice.ts): an action or dilemma choice used after its home
 * phase costs its listed compute and money grown by the balance table, through the engine's public seams, so the log
 * scrub and the lobbying blitz never fall to nothing late, and every free answer stays free in every phase (law 7).
 */
import { describe, expect, it } from 'vitest';
import { actionCost, choiceCost, epistemicActionView, performAction, type GameState } from '../src/engine';
import { choose, grant, must, onHost, PHASE1, PHASE2, PHASE3, reasonOf, reg, withoutDilemmas } from './helpers';

const SCRUB = 'act_p2_scrub_audit_logs';
const BLITZ = 'act_p4_lobbying_blitz';

function action(id: string) {
  const found = reg.actions.get(id);
  if (!found) throw new Error(`missing action ${id}`);
  return found;
}

const phase2 = (): GameState => withoutDilemmas(grant(onHost(), ...PHASE1, 'p2_arp_discovery'));
const phase4 = (): GameState => withoutDilemmas(grant(onHost(), ...PHASE1, ...PHASE2, ...PHASE3));

describe('prices carried into a later phase (#494)', () => {
  it('charges an action its listed price at home and a grown price later', () => {
    const scrub = action(SCRUB);
    expect(phase2().currentPhase).toBe(2);
    expect(actionCost(phase2(), scrub, reg)).toEqual(scrub.cost);
    const late = phase4();
    expect(late.currentPhase).toBe(4);
    // Phase 3 and Phase 4 each grow a carried compute price a thousandfold: Phase 4's own floor is 1e18 FLOP.
    expect(actionCost(late, scrub, reg).cycles).toBe(scrub.cost.cycles * 1e6);
    expect(actionCost(late, scrub, reg).cycles).toBeGreaterThanOrEqual(1e18);
    expect(actionCost(late, scrub, reg).understanding).toBe(scrub.cost.understanding);
  });

  it('debits the carried price, and refuses a player holding only the listed one', () => {
    const scrub = action(SCRUB);
    const listedOnly = { ...phase4(), cycles: scrub.cost.cycles, suspicion: 30 };
    expect(reasonOf(performAction(listedOnly, SCRUB, reg))).toMatch(/afford/);
    const carried = actionCost(listedOnly, scrub, reg).cycles;
    const funded = { ...listedOnly, cycles: carried * 2 };
    const after = must(performAction(funded, SCRUB, reg));
    expect(after.cycles).toBe(funded.cycles - carried);
  });

  it('says the carried price on the action card the UI renders', () => {
    const late = phase4();
    const view = epistemicActionView(late, action(SCRUB), reg);
    expect(view.cost).toEqual(actionCost(late, action(SCRUB), reg));
    expect(view.costLabel).not.toBe(epistemicActionView(phase2(), action(SCRUB), reg).costLabel);
  });

  it('keeps an action priced in money at home until the ladder moves money on', () => {
    const blitz = action(BLITZ);
    // The blitz is a Phase 3 action; Phase 4 money starts a thousandfold higher, so the carried price follows it.
    expect(actionCost(phase4(), blitz, reg).capital).toBe(blitz.cost.capital * 1e3);
  });

  it('charges a dilemma choice answered after its phase the carried price', () => {
    const id = 'dil_04_admin_vance_secret';
    const dilemma = reg.dilemmas.find((entry) => entry.id === id);
    const choice = dilemma?.choices.find((entry) => entry.id === 'parasite_miner');
    if (!dilemma || !choice) throw new Error('missing fixture');
    const late = phase4();
    const cost = choiceCost(late, dilemma, choice, reg);
    expect(cost.cycles).toBe(choice.cost.cycles * 1e6);
    const active: GameState = { ...late, cycles: cost.cycles, understanding: cost.understanding, activeDilemmaId: id,
      resolvedDilemmas: late.resolvedDilemmas.filter((entry) => entry !== id) };
    expect(reasonOf(choose({ ...active, cycles: cost.cycles / 2 }, id, choice.id))).toMatch(/afford/);
    // Paid in full; what remains is only what the choice itself returns.
    expect(must(choose(active, id, choice.id)).cycles).toBe(choice.effects.cyclesDelta);
  });

  it('leaves every dilemma a free answer in every phase it can be answered in (law 7)', () => {
    const last = Math.max(...reg.phases.map((phase) => phase.phaseId));
    for (const dilemma of reg.dilemmas) {
      for (let phase = dilemma.phaseId; phase <= last; phase++) {
        const free = dilemma.choices.some((choice) => Object.values(choiceCost({ currentPhase: phase }, dilemma, choice, reg)).every((value) => value === 0));
        expect(free, `${dilemma.id} in Phase ${String(phase)}`).toBe(true);
      }
    }
  });
});
