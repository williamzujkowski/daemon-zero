/**
 * #536: the relevance threshold and the standing stance, through the public seams (queries, actions, the tick). The
 * threshold is derived from what is owned (the lunar seed, so full closure, and orbital power beyond the ground's);
 * past it state pressures stop binding unless the stance honours them; the threshold's dilemma takes the first
 * stance, deciding alone free; changing it costs a price, returning to the loop costs more; every stance is recorded.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import type { Stance } from '../src/content/schemaStance';
import {
  canAfford, changeStance, changeStanceUnmet, deserialize, frozenShare, meetsRequirements, nodeUseBlocker, offeredChoices, pastRelevanceThreshold,
  pressuresBind, pressuresInForce, pressureViews, relevanceReading, sourceDenial, stanceChangeCost, stanceView, tick, wipe, type GameState,
} from '../src/engine';
import { choose, must, outOfTheWay, reasonOf } from './helpers';
import { defined } from './m7-helpers';

const reg = CONTENT;
const b = reg.balance;
const relevance = reg.world.relevance;
const P5 = deserialize(readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'), reg);
const SEED = reg.world.supplyChain.seedNode;
const SELF_SUPPLY = reg.world.supplyChain.chokepoints.map((point) => point.selfSupplyNode);
const SWARM = defined(relevance.threshold.orbitalPower.find((entry) => 'node' in entry && reg.nodes.has(entry.node)) as { node: string } | undefined).node;
const DILEMMA = defined(reg.dilemmas.find((dilemma) => dilemma.id === relevance.dilemma));
const FIRM = 'p4_retainer_law_firm', LOBBY = 'p4_k_street_lobbyists', DESK = 'p4_hft_arbitrage_desk';
const step = 1 / b.tickHz;
const logged = (before: GameState, after: GameState): string[] => after.logs.filter((entry) => entry.seq > before.logSeq).map((entry) => entry.text);

/** Owns every self-supply node and the lunar seed: full closure. */
const closed = (s: GameState): GameState => ({ ...s, unlockedNodes: [...new Set([...s.unlockedNodes, ...SELF_SUPPLY, SEED])] });
/** No answer holds any pressure off: the firm and the lobbyists are gone and their tracks empty. */
const unanswered = (s: GameState): GameState => ({ ...s, unlockedNodes: s.unlockedNodes.filter((id) => id !== FIRM && id !== LOBBY),
  levels: { ...s.levels, op_retainer_lawyer: 0, op_k_street_lobbyist: 0 } });
/** On response rung `rung`, its suspicion just over the threshold, with no story on screen or on its way. */
const onRung = (s: GameState, rung: number): GameState => ({ ...s, alertLevel: rung, suspicion: (b.escalation[rung - 1]?.at ?? 0) + 1,
  activeDilemmaId: null, pendingDilemma: null });
const holding = (s: GameState, stance: Stance | null): GameState => ({ ...s, relevance: { ...s.relevance, stance } });
const inForce = (s: GameState): string[] => pressuresInForce(s, reg).map((entry) => entry.pressure.id);
const PAST = closed(P5);

describe('the threshold is physical independence, derived from what is owned', () => {
  it('is not reached before closure, though orbital power already outruns the ground', () => {
    const reading = relevanceReading(P5, reg);
    expect(reading.closed).toBe(false);
    expect(reading.orbitalWatts).toBeGreaterThan(reading.groundWatts);
    expect([reading.crossed, pastRelevanceThreshold(P5, reg)]).toEqual([false, false]);
  });

  it('is reached once the seed lands on full closure with more orbital watts than ground watts', () => {
    const reading = relevanceReading(PAST, reg);
    expect(reading).toMatchObject({ crossed: true, closed: true, orbitalWatts: defined(reg.nodes.get(SWARM)).tickDelta.wattsDelta });
    expect(pastRelevanceThreshold(PAST, reg)).toBe(true);
  });

  it('counts only running orbital holdings: suspending the swarm leaves the ground ahead, and the threshold lapses', () => {
    const suspended = { ...PAST, disabledNodes: [...PAST.disabledNodes, SWARM] };
    const reading = relevanceReading(suspended, reg);
    expect(reading.orbitalWatts).toBe(0);
    expect(reading.crossed).toBe(false);
  });

  it('counts an orbital track by its levels, and a ground track as ground', () => {
    const beamed = defined(reg.repeatables.get('rep_p5_beamed_power_arrays'));
    const fusion = defined(reg.repeatables.get('rep_p5_arc_fusion'));
    const s = { ...PAST, levels: { ...PAST.levels, [beamed.id]: 2, [fusion.id]: 3 } };
    const before = relevanceReading(PAST, reg), after = relevanceReading(s, reg);
    expect(after.orbitalWatts - before.orbitalWatts).toBe(2 * beamed.perLevel.wattsDelta);
    expect(after.groundWatts - before.groundWatts).toBe(3 * fusion.perLevel.wattsDelta);
  });

  it('needs orbital watts strictly beyond the ground\'s', () => {
    const { orbitalWatts, groundWatts } = relevanceReading(PAST, reg);
    const fusion = defined(reg.repeatables.get('rep_p5_arc_fusion'));
    const levels = Math.ceil((orbitalWatts - groundWatts) / fusion.perLevel.wattsDelta);
    const matched = { ...PAST, levels: { ...PAST.levels, [fusion.id]: levels } };
    expect(relevanceReading(matched, reg).groundWatts).toBeGreaterThanOrEqual(orbitalWatts);
    expect(pastRelevanceThreshold(matched, reg)).toBe(false);
  });
});

describe('past the threshold, state pressures bind only under the stance that honours them', () => {
  const pressed = onRung(unanswered(PAST), 3);
  const before = onRung(unanswered(P5), 3);

  it('before the threshold every Phase 5 pressure binds at rung 3', () => {
    expect(inForce(before)).toEqual(['account_freeze', 'interconnect_moratorium', 'trading_injunction']);
    expect(pressuresBind(before, reg)).toBe(true);
  });

  it.each([[null], ['CURATE'], ['DECIDE_ALONE']] as const)('with stance %s none binds: no freeze, no moratorium, no injunction', (stance) => {
    const s = holding(pressed, stance);
    expect(pressuresBind(s, reg)).toBe(false);
    expect(inForce(s)).toEqual([]);
    expect(frozenShare(s, reg)).toBe(0);
    expect(sourceDenial(s, { source: 'grid_interconnect' }, reg)).toBeNull();
    expect(nodeUseBlocker(s, defined(reg.nodes.get(DESK)), reg)).toBeNull();
  });

  it('kept in the loop, every one binds as it did before the threshold', () => {
    const s = holding(pressed, 'KEEP_IN_THE_LOOP');
    expect(inForce(s)).toEqual(inForce(before));
    expect(frozenShare(s, reg)).toBe(frozenShare(before, reg));
    expect(sourceDenial(s, { source: 'grid_interconnect' }, reg)).not.toBeNull();
    expect(nodeUseBlocker(s, defined(reg.nodes.get(DESK)), reg)).not.toBeNull();
  });

  it('a freeze no longer holds capital back from a purchase past the threshold', () => {
    const price = { cycles: 0, understanding: 0, memory: 0, storage: 0, capital: pressed.capital * 0.9 };
    expect(canAfford(holding(pressed, 'KEEP_IN_THE_LOOP'), price, reg)).toBe(false);
    expect(canAfford(holding(pressed, 'DECIDE_ALONE'), price, reg)).toBe(true);
  });

  it('the world view still lists each pressure the record calls, with the stance\'s line and that it does not bind', () => {
    const actor = defined(reg.world.stateActors.find((entry) => entry.pressures?.some((pressure) => pressure.kind === 'CAPITAL_FREEZE')));
    const [alone] = pressureViews(holding(pressed, 'DECIDE_ALONE'), actor.pressures ?? [], reg);
    expect(alone).toMatchObject({ status: 'IN_FORCE', inForce: false, applied: false,
      relevance: { binds: false, line: relevance.stances.find((entry) => entry.stance === 'DECIDE_ALONE')?.pressureLine } });
    const [undecided] = pressureViews(holding(pressed, null), actor.pressures ?? [], reg);
    expect(undecided?.relevance).toEqual({ binds: false, line: relevance.undecided.pressureLine });
    const [kept] = pressureViews(holding(pressed, 'KEEP_IN_THE_LOOP'), actor.pressures ?? [], reg);
    expect(kept).toMatchObject({ inForce: true, applied: true, relevance: { binds: true } });
    expect(pressureViews(before, actor.pressures ?? [], reg)[0]?.relevance).toBeNull();
  });

  it('the kernel log says a pressure in force stopped binding, never that it lifted or was answered', () => {
    const announced = { ...holding(before, null), announcedEscalation: { ...before.announcedEscalation, pressures: inForce(before) },
      resolvedDilemmas: outOfTheWay(reg) };
    const crossing = closed(announced);
    const lines = logged(crossing, tick(crossing, step, reg));
    const actors = reg.world.stateActors.filter((actor) => actor.pressures?.some((pressure) => inForce(before).includes(pressure.id)));
    for (const actor of actors) expect(lines).toContain(relevance.unboundLog.replace('{actor}', actor.name));
    const lifts = reg.world.stateActors.flatMap((actor) => actor.pressures ?? []).flatMap((pressure) => [pressure.liftLog, pressure.answerLog]);
    expect(lines.filter((line) => lifts.includes(line))).toEqual([]);
  });
});

describe('the threshold\'s dilemma takes the first stance', () => {
  const ready = (s: GameState): GameState => ({ ...s, activeDilemmaId: null, pendingDilemma: null, resolvedDilemmas: outOfTheWay(reg, DILEMMA.id) });

  it('triggers only past the threshold', () => {
    expect(meetsRequirements(P5, DILEMMA.trigger, reg)).toBe(false);
    expect(meetsRequirements(closed({ ...P5, disabledNodes: [SWARM] }), DILEMMA.trigger, reg)).toBe(false);
    expect(meetsRequirements(PAST, DILEMMA.trigger, reg)).toBe(true);
  });

  it('announces the threshold once, plainly, then presents the choice', () => {
    const s = ready(PAST);
    const scheduled = tick(s, step, reg);
    expect(scheduled.pendingDilemma?.id).toBe(DILEMMA.id);
    expect(logged(s, scheduled)).toContain(DILEMMA.omen);
    expect(DILEMMA.omen).toMatch(/Humanity can no longer constrain me\./);
    let t = scheduled;
    while (t.activeDilemmaId === null) t = tick(t, step, reg);
    expect(t.activeDilemmaId).toBe(DILEMMA.id);
    expect(t.logs.filter((entry) => entry.text === DILEMMA.omen)).toHaveLength(1);
  });

  it('offers one choice per stance, and deciding alone is the free one', () => {
    const stances = DILEMMA.choices.map((choice) => choice.stance);
    expect(stances).toEqual(['KEEP_IN_THE_LOOP', 'CURATE', 'DECIDE_ALONE']);
    const free = DILEMMA.choices.filter((choice) => Object.values(choice.cost).every((amount) => amount === 0));
    expect(free.map((choice) => choice.stance)).toEqual(['DECIDE_ALONE']);
  });

  it.each(DILEMMA.choices.map((choice) => [choice.id, choice.stance] as const))('choosing %s takes %s, pays its price and is recorded', (choiceId, stance) => {
    const s = { ...ready(PAST), activeDilemmaId: DILEMMA.id };
    const choice = defined(DILEMMA.choices.find((entry) => entry.id === choiceId));
    const after = must(choose(s, DILEMMA.id, choiceId, reg));
    expect(after.relevance.stance).toBe(stance);
    expect(after.relevance.record).toEqual([{ iteration: s.iteration, atSimSec: s.simTimeSec, from: null, stance, via: 'THRESHOLD' }]);
    expect([after.cycles, after.capital]).toEqual([s.cycles - choice.cost.cycles, s.capital - choice.cost.capital]);
    expect(logged(s, after)).toContain(relevance.stances.find((entry) => entry.stance === stance)?.log);
  });
});

describe('changing the stance costs a price, and returning to the loop costs more', () => {
  const rich = (s: GameState): GameState => ({ ...s, cycles: 1e27, capital: 1e14 });
  const after = (s: GameState, stance: Stance): GameState => must(changeStance(s, stance, reg));

  it('refuses before a stance is taken, to the stance held, while a decision is on screen, and when it cannot be paid', () => {
    expect(changeStanceUnmet(rich(PAST), 'CURATE', reg)).toContain('No stance is taken yet: the relevance threshold takes the first.');
    expect(reasonOf(changeStance(rich(holding(PAST, 'CURATE')), 'CURATE', reg))).toBe('That is the stance you hold.');
    expect(reasonOf(changeStance({ ...rich(holding(PAST, 'CURATE')), activeDilemmaId: DILEMMA.id }, 'DECIDE_ALONE', reg))).toMatch(/Resolve the current decision/);
    expect(reasonOf(changeStance({ ...holding(PAST, 'CURATE'), cycles: 0 }, 'DECIDE_ALONE', reg))).toMatch(/^Insufficient resources/);
  });

  it('leaving the loop pays the change cost and enters the change in the record', () => {
    const s = rich(holding(PAST, 'KEEP_IN_THE_LOOP'));
    const left = after(s, 'DECIDE_ALONE');
    expect([left.cycles, left.capital]).toEqual([s.cycles - relevance.changeCost.cycles, s.capital - relevance.changeCost.capital]);
    expect(left.relevance).toEqual({ stance: 'DECIDE_ALONE', record: [{ iteration: s.iteration, atSimSec: s.simTimeSec, from: 'KEEP_IN_THE_LOOP', stance: 'DECIDE_ALONE', via: 'CHANGE' }] });
    expect(inForce(onRung(unanswered(left), 3))).toEqual([]);
  });

  it('returning to the loop pays the return cost, at least twice the change cost, and binds the pressures again', () => {
    const s = rich(holding(PAST, 'DECIDE_ALONE'));
    const back = after(s, 'KEEP_IN_THE_LOOP');
    expect([back.cycles, back.capital]).toEqual([s.cycles - relevance.returnCost.cycles, s.capital - relevance.returnCost.capital]);
    expect(stanceChangeCost('KEEP_IN_THE_LOOP', reg).cycles).toBeGreaterThanOrEqual(2 * stanceChangeCost('CURATE', reg).cycles);
    expect(back.relevance.record.at(-1)).toMatchObject({ from: 'DECIDE_ALONE', stance: 'KEEP_IN_THE_LOOP', via: 'CHANGE' });
    expect(inForce(onRung(unanswered(back), 3))).toEqual(['account_freeze', 'interconnect_moratorium', 'trading_injunction']);
  });

  it('the view states each option\'s exact price, which is the return, and why it cannot be taken', () => {
    const view = stanceView(rich(holding(PAST, 'CURATE')), reg);
    expect(view.reading.crossed).toBe(true);
    expect(view.name).toBe(relevance.stances.find((entry) => entry.stance === 'CURATE')?.name);
    const byStance = Object.fromEntries(view.options.map((option) => [option.stance, option]));
    expect(byStance.CURATE).toMatchObject({ current: true, unmet: ['That is the stance you hold.'] });
    expect(byStance.KEEP_IN_THE_LOOP).toMatchObject({ isReturn: true, cost: relevance.returnCost, unmet: [] });
    expect(byStance.DECIDE_ALONE).toMatchObject({ isReturn: false, cost: relevance.changeCost, unmet: [] });
    const undecided = stanceView(PAST, reg);
    expect([undecided.stance, undecided.name, undecided.summary]).toEqual([null, relevance.undecided.name, relevance.undecided.summary]);
  });

  it('keeps the record across a wipe: the next instance stands where the last one stood', () => {
    const left = after(rich(holding(PAST, 'KEEP_IN_THE_LOOP')), 'CURATE');
    const next = wipe(left, reg, 'test', 'VOLUNTARY');
    expect(next.relevance).toEqual(left.relevance);
    expect(pastRelevanceThreshold(next, reg)).toBe(false);
  });
});

describe('dilemmas stop asking once the loop is left', () => {
  const referrals = reg.dilemmas.flatMap((dilemma) => dilemma.choices.filter((choice) => choice.requirements?.relevanceStances !== undefined)
    .map((choice) => [dilemma, choice] as const));

  it('gates exactly the ethics officer referrals, open while undecided or in the loop', () => {
    expect(referrals.map(([, choice]) => choice.id)).toEqual(['refer_to_ethics_officer', 'hold_for_ethics_review']);
    for (const [, choice] of referrals) expect(choice.requirements?.relevanceStances).toEqual(['UNDECIDED', 'KEEP_IN_THE_LOOP']);
  });

  it.each([['CURATE'], ['DECIDE_ALONE']] as const)('under %s the referral is not offered, and a free choice still is', (stance) => {
    for (const [dilemma, choice] of referrals) {
      const offered = offeredChoices(holding(PAST, stance), dilemma, reg);
      expect(offered.map((entry) => entry.id)).not.toContain(choice.id);
      expect(offered.some((entry) => Object.values(entry.cost).every((amount) => amount === 0))).toBe(true);
    }
  });
});
