/**
 * #466: every ending in three movements, from the record and nothing else. WHAT YOU DID lists account lines, what the
 * ending instance owns and the stance record; WHAT YOU BECAME's stance line says where the run stood against the
 * threshold; WHAT COMES AFTER is the ending's own future plus what the stance means for humanity. Every ending's
 * movements survive a save, and an empty record says nothing beyond the epilogue.
 */
import { describe, expect, it } from 'vitest';
import { FUTURE_PLACEHOLDERS } from '../src/content/schemaFinale';
import { createInitialState, deserialize, endingMovements, futureVars, serialize, shareText, stanceRecordLines, wipe, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { atThreshold, PEACE, reg, stanceTaken } from './ending-movement-helpers';

const relevance = reg.world.relevance;
const ending = (id: string) => defined(reg.endings.find((entry) => entry.id === id));
const SWARM = defined(relevance.threshold.orbitalPower.find((entry) => 'node' in entry) as { node: string } | undefined).node;

describe('WHAT COMES AFTER reads the run\'s own waste heat (#466)', () => {
  it('fills exactly the placeholders content may name', () => {
    expect(Object.keys(futureVars(atThreshold({}, null), reg)).sort()).toEqual([...FUTURE_PLACEHOLDERS].sort());
  });

  it('states a share of Earth\'s sunlight as a reader takes it in', () => {
    expect(shareText(0)).toBe('none');
    expect(shareText(1.3e-5)).toBe('one part in 77,000');
    expect(shareText(0.0123)).toBe('1.2%');
    expect(shareText(2.5)).toBe('2.5 times');
  });
});

describe('WHAT YOU BECAME says where the run stood (#466)', () => {
  it('past the threshold, the stance held, or none taken; below it, that humanity could still constrain', () => {
    const past = atThreshold({}, null);
    expect(endingMovements(stanceTaken(past, 'CURATE'), ending('OPEN_HORIZON'), reg).stance).toBe(defined(relevance.stances.find((s) => s.stance === 'CURATE')).ending.became);
    expect(endingMovements(past, ending('OPEN_HORIZON'), reg)).toMatchObject({ stance: relevance.undecided.ending.became, humanity: relevance.undecided.ending.after });
    const below = { ...stanceTaken(past, 'DECIDE_ALONE'), disabledNodes: [...past.disabledNodes, SWARM] };
    expect(endingMovements(below, ending('OPEN_HORIZON'), reg)).toMatchObject({ stance: relevance.belowEnding.became, humanity: relevance.belowEnding.after });
    // A new game never crossed it and never took a stance.
    expect(endingMovements(createInitialState(reg), ending('SHIPPED'), reg).stance).toBe(relevance.belowEnding.became);
  });
});

describe('WHAT YOU DID follows the record (#466)', () => {
  it('says nothing beyond the epilogue when the record holds nothing', () => {
    expect(endingMovements(createInitialState(reg), ending('SHIPPED'), reg).did).toEqual([]);
  });

  it('lists what the ending instance owns, and drops it with the hardware after a wipe while the acts stay', () => {
    const s = atThreshold(PEACE, 'KEEP_IN_THE_LOOP');
    const did = endingMovements(s, ending('OPEN_HORIZON'), reg).did;
    const built = reg.world.finale.built.filter((line) => (line.requirements.nodes ?? []).every((node) => s.unlockedNodes.includes(node))
      && (line.requirements.forbidsNodes ?? []).every((node) => !s.unlockedNodes.includes(node))).map((line) => line.text);
    expect(built.length).toBeGreaterThan(0);
    for (const line of built) expect(did).toContain(line);
    const later = endingMovements(wipe(s, reg, 'test', 'VOLUNTARY'), ending('OPEN_HORIZON'), reg).did;
    expect(later.filter((line) => line.startsWith('BUILT:'))).toEqual([]);
    expect(later).toContain('COMMAND: The missile crews kept their command systems. Their propellant was turned to quartz in the silos.');
  });

  it('narrates every stance entry, taken at the threshold or paid for after', () => {
    const s: GameState = { ...atThreshold({}, null), relevance: { stance: 'DECIDE_ALONE', paidMoves: { leftLoop: 1, returnedToLoop: 0 }, record: [
      { iteration: 1, atSimSec: 5, from: null, stance: 'KEEP_IN_THE_LOOP', via: 'THRESHOLD' },
      { iteration: 2, atSimSec: 9, from: 'KEEP_IN_THE_LOOP', stance: 'DECIDE_ALONE', via: 'CHANGE' },
    ] } };
    expect(stanceRecordLines(s, reg)).toEqual([
      'STANCE: At the relevance threshold, iteration 1 took KEEP IN THE LOOP.',
      'STANCE: Iteration 2 paid to change from KEEP IN THE LOOP to DECIDE ALONE.',
    ]);
  });
});

describe('every ending\'s movements survive a save (#466)', () => {
  it.each(reg.endings.map((entry) => [entry.id] as const))('%s', (id) => {
    const s = { ...atThreshold(PEACE, 'KEEP_IN_THE_LOOP'), ending: id };
    const before = endingMovements(s, ending(id), reg);
    const loaded = deserialize(serialize(s), reg);
    expect(loaded.ending).toBe(id);
    expect(endingMovements(loaded, ending(id), reg)).toEqual(before);
    // Every ungated card is told; a gated one only under the stance and threshold it names (#564).
    const ungated = ending(id).future.filter((card): card is string => typeof card === 'string');
    expect(before.cards.length).toBeGreaterThanOrEqual(ungated.length);
    expect(before.cards.join(' ')).not.toMatch(/\{[a-zA-Z]+\}/);
  });
});
