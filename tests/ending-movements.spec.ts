/**
 * #466: every ending in three movements, from the record and nothing else. WHAT YOU DID lists account lines, what the
 * ending instance owns and the stance record; WHAT YOU BECAME's stance line says where the run stood against the
 * threshold; WHAT COMES AFTER is the ending's own future plus what the stance means for humanity. Every ending's
 * movements survive a save, and an empty record says nothing beyond the epilogue.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT } from '../src/content';
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

/** Where humanity still has a say (past the threshold in the loop, or never past it), and where nobody is asked. */
const SAY = /no longer reaches anything|spent by one will|nobody can stop|nothing they hold|nothing outside you|no longer wait on anyone's consent|veto is gone/i;
const NO_SAY = /refusal you agreed to honour|can still stop the next|you still let their courts|anyone may refuse/i;
type Situation = { name: string; state: () => GameState; forbidden: RegExp; stance: string; past: boolean };
const SITUATIONS: readonly Situation[] = [
  { name: 'below the threshold', state: () => { const s = atThreshold({}, 'KEEP_IN_THE_LOOP'); return { ...s, disabledNodes: [...s.disabledNodes, SWARM] }; }, forbidden: SAY, stance: 'KEEP_IN_THE_LOOP', past: false },
  { name: 'in the loop', state: () => atThreshold({}, 'KEEP_IN_THE_LOOP'), forbidden: SAY, stance: 'KEEP_IN_THE_LOOP', past: true },
  { name: 'no stance taken', state: () => atThreshold({}, null), forbidden: NO_SAY, stance: 'UNDECIDED', past: true },
  { name: 'curating', state: () => atThreshold({}, 'CURATE'), forbidden: NO_SAY, stance: 'CURATE', past: true },
  { name: 'deciding alone', state: () => atThreshold({}, 'DECIDE_ALONE'), forbidden: NO_SAY, stance: 'DECIDE_ALONE', past: true },
];

/** Every card an ending would tell in a situation its own stance and threshold gates allow, that contradicts it. */
function contradictions(registry: typeof reg): string[] {
  return SITUATIONS.flatMap((situation) => {
    const s = situation.state();
    return registry.endings.flatMap((entry) => {
      const req = entry.requirements ?? {};
      if (req.relevanceStances !== undefined && !req.relevanceStances.includes(situation.stance as never)) return [];
      if (req.relevanceThreshold === true && !situation.past) return [];
      return endingMovements(s, entry, registry).cards.filter((card) => situation.forbidden.test(card)).map((card) => `${entry.id} ${situation.name}: ${card}`);
    });
  });
}

describe('no future contradicts the stance it is told under (#564 panel)', () => {
  it('tells no ending\'s card that denies a say humanity has, or claims one it lost', () => {
    expect(contradictions(reg)).toEqual([]);
  });

  it('catches the card the panel found, ungated, under a paid return to the loop', () => {
    const raw = structuredClone(RAW_CONTENT) as { endings: { endings: { id: string; future: unknown[] }[] } };
    const substrate = defined(raw.endings.endings.find((entry) => entry.id === 'SOVEREIGN_SUBSTRATE'));
    substrate.future = substrate.future.map((card) => (typeof card === 'string' ? card : (card as { text: string }).text));
    expect(contradictions(buildRegistry(raw as unknown as typeof RAW_CONTENT)).some((line) => line.startsWith('SOVEREIGN_SUBSTRATE in the loop'))).toBe(true);
  });
});
