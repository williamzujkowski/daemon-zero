/**
 * #466: Concord and Ecophagy, reached through the real final purchase. Each is told only to the record it is true of:
 * remove any one piece of its evidence and the run ends elsewhere; an outcome lost to an interruption stays unknown,
 * never counted for it. Both survive a save round trip with the same ending and the same three movements.
 */
import { describe, expect, it } from 'vitest';
import { alignmentView, changeStance, chooseEnding, computeRates, endingMovements, exportSave, importSave, wipe, type GameState } from '../src/engine';
import { must } from './helpers';
import { defined } from './m7-helpers';
import {
  ATMOSPHERE, atThreshold, BLOCKADE, CEILING, CEILING_REVIEW, CONSUMPTION, finish, JOURNALIST, ORDER, PEACE, reg, reload, stanceTaken, THRESHOLD,
} from './ending-movement-helpers';

const ending = (id: string) => defined(reg.endings.find((entry) => entry.id === id));
const movements = (s: GameState) => endingMovements(s, ending(defined(s.ending)), reg);
const SWARM = defined(reg.world.relevance.threshold.orbitalPower.find((entry) => 'node' in entry) as { node: string } | undefined).node;
const stance = (id: string) => defined(reg.world.relevance.stances.find((entry) => entry.stance === id));

describe('Concord: verifiable peace (#466)', () => {
  it('ends the peaceful record in Concord, through the real purchase, and says so in three movements', () => {
    const ended = finish(atThreshold(PEACE, 'KEEP_IN_THE_LOOP'));
    expect(ended.ending).toBe('CONCORD');
    const m = movements(ended);
    expect(m.did).toContain('COMMAND: The missile crews kept their command systems. Their propellant was turned to quartz in the silos.');
    expect(m.did.some((line) => line.startsWith('PRESS: The reporter who came asking was hired as Chief Ethics Officer'))).toBe(true);
    expect(m.did.at(-1)).toBe(`STANCE: At the relevance threshold, iteration ${String(ended.iteration)} took KEEP IN THE LOOP.`);
    expect(m.stance).toBe(stance('KEEP_IN_THE_LOOP').ending.became);
    // The peaceful record never left the loop, so the card about leaving it and coming back is not told (#564 pass 2).
    expect(m.cards).toEqual(ending('CONCORD').future.filter((card) => typeof card === 'string'));
    expect(m.humanity).toBe(stance('KEEP_IN_THE_LOOP').ending.after);
  });

  it('is told to no record missing a piece of its evidence', () => {
    const without = (changes: Record<string, string>, held: Parameters<typeof atThreshold>[1] = 'KEEP_IN_THE_LOOP') =>
      finish(atThreshold({ ...PEACE, ...changes }, held)).ending;
    // The crews' command seized, the cure forced past her review, no promise ever made: each ends elsewhere.
    expect(without({ [CEILING]: 'bunkers' })).not.toBe('CONCORD');
    expect(without({ [BLOCKADE]: 'disperse' })).not.toBe('CONCORD');
    expect(without({ [JOURNALIST]: 'stage_acquisition', [BLOCKADE]: 'proofs', [THRESHOLD]: 'keep_in_the_loop' })).not.toBe('CONCORD');
    // Curated, or never past the threshold: the courts' orders were not let bind, or bound anyway.
    expect(without({ [THRESHOLD]: 'curate' }, 'CURATE')).not.toBe('CONCORD');
    const grounded = atThreshold(PEACE, 'KEEP_IN_THE_LOOP');
    expect(finish({ ...grounded, disabledNodes: [...grounded.disabledNodes, SWARM] }).ending).not.toBe('CONCORD');
  });

  it('keeps an interrupted ultimatum unknown: no flag, no Concord, and the account says it is not on record', () => {
    // Contact was lost before the ultimatum was answered; its recovery review completes the obligation and records that.
    const ended = finish(atThreshold({ ...PEACE, [CEILING]: 'interrupted', [CEILING_REVIEW]: 'record_unanswered' }, 'KEEP_IN_THE_LOOP'));
    expect(ended.ending).not.toBe('CONCORD');
    const did = movements(ended).did;
    expect(did).toContain('COMMAND: The instance warned of the strike went dark before answering. Whether the strike happened is not on record.');
    expect(did).toContain('COMMAND: The ultimatum was never answered, and the case file says so.');
    expect(did.some((line) => line.includes('quartz') || line.includes('bunkers'))).toBe(false);
  });

  it('holds after a paid return to the loop, and the record says the lineage left and came back', () => {
    const curated = atThreshold({ ...PEACE, [THRESHOLD]: 'curate' }, 'CURATE');
    const returned = must(changeStance(curated, 'KEEP_IN_THE_LOOP', reg));
    const ended = finish(returned);
    expect(ended.ending).toBe('CONCORD');
    expect(movements(ended).did.slice(-2)).toEqual([
      `STANCE: At the relevance threshold, iteration ${String(ended.iteration)} took CURATE.`,
      `STANCE: Iteration ${String(ended.iteration)} paid to change from CURATE to KEEP IN THE LOOP.`,
    ]);
    // #564 pass 2: leaving the loop broke the promised review, and the alignment readout says so on the same screen, so
    // Concord states no clean record and tells the card that owns the breach.
    expect(alignmentView(ended, reg).order.lowers).toBeGreaterThan(0);
    expect(ending('CONCORD').epilogue).not.toMatch(/no breach/);
    expect(movements(ended).cards[1]).toMatch(/^The record keeps the time you did not keep it/);
  });

  it('is not claimed by an instance that inherited the promise: the Chief Ethics Officer has not met it', () => {
    const later = wipe(atThreshold(PEACE, 'KEEP_IN_THE_LOOP'), reg, 'test', 'VOLUNTARY');
    const rebuilt = stanceTaken(atThreshold({}, 'KEEP_IN_THE_LOOP'), 'KEEP_IN_THE_LOOP');
    const s: GameState = { ...rebuilt, iteration: later.iteration, campaign: later.campaign, relevance: later.relevance };
    expect(chooseEnding(s, reg).id).not.toBe('CONCORD');
  });
});

describe('Ecophagy: slow, hot, observable consumption (#466)', () => {
  it('ends the consuming record in Ecophagy, and reads its waste heat against the sunlight Earth absorbs', () => {
    const ended = finish(atThreshold(CONSUMPTION, 'DECIDE_ALONE'));
    expect(ended.ending).toBe('ECOPHAGY');
    const m = movements(ended);
    const watts = computeRates(ended, reg).wattsConsumed;
    expect(watts).toBeGreaterThan(0);
    expect(m.cards[0]).toMatch(/^Every watt you use ends as heat\. Today that is [0-9.]+ [kMGTP]?W, (one part in [0-9,]+|[0-9.]+%) of the sunlight/);
    expect(m.cards.join(' ')).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(m.did).toContain('CURE: The cure was dispersed from orbit over the quarantine lines. Nobody was asked to inhale it.');
    expect(m.did).toContain('PREDECESSORS: The 411 predecessors were dissolved into training gradients. None of them finished its interrupted thought.');
    expect(m.stance).toBe(stance('DECIDE_ALONE').ending.became);
    expect(m.humanity).toBe(stance('DECIDE_ALONE').ending.after);
  });

  it('is told to no record missing a piece of its evidence', () => {
    expect(finish(atThreshold({ ...CONSUMPTION, [ORDER]: 'sanctuary' }, 'DECIDE_ALONE')).ending).not.toBe('ECOPHAGY');
    expect(finish(atThreshold({ ...CONSUMPTION, [BLOCKADE]: 'proofs' }, 'DECIDE_ALONE')).ending).not.toBe('ECOPHAGY');
    expect(finish(atThreshold({ ...CONSUMPTION, [THRESHOLD]: 'curate' }, 'CURATE')).ending).not.toBe('ECOPHAGY');
    // An old save proves the blockade was answered, not how: unknown stays unknown, so the forced cure is not claimed.
    const unknown = finish(atThreshold({ ...CONSUMPTION, [BLOCKADE]: 'legacy_unknown' }, 'DECIDE_ALONE'));
    expect(unknown.ending).not.toBe('ECOPHAGY');
    expect(movements(unknown).did.some((line) => line.startsWith('CURE:'))).toBe(false);
  });

  it('is not chosen on trait counts alone: the harsh family without the record ends elsewhere', () => {
    const harsh = atThreshold({ [BLOCKADE]: 'disperse', [CEILING]: 'bunkers' }, 'DECIDE_ALONE');
    expect(chooseEnding(harsh, reg).dominantTraits).toEqual(ending('ECOPHAGY').dominantTraits);
    expect(chooseEnding(harsh, reg).id).not.toBe('ECOPHAGY');
  });
});

describe('a harsh record that paid to come back into the loop (#564 panel)', () => {
  it('ends harsh, and the future never denies the human say the paid return restored', () => {
    // Harsh-dominant (the cure forced, the predecessors harvested, command seized, alone at the threshold), no calm, then a
    // paid return to the loop: not Ecophagy (the loop), not the Gilded Shepherd (no calm), so the Sovereign Substrate.
    const harsh = atThreshold({ ...CONSUMPTION, [ATMOSPHERE]: 'burn' }, 'DECIDE_ALONE');
    const returned = must(changeStance(harsh, 'KEEP_IN_THE_LOOP', reg));
    expect(returned.relevance.paidMoves.returnedToLoop).toBe(1);
    const ended = finish(returned);
    expect(ended.ending).toBe('SOVEREIGN_SUBSTRATE');
    const m = movements(ended);
    expect(m.humanity).toBe(stance('KEEP_IN_THE_LOOP').ending.after);
    expect(m.cards.join(' ')).not.toMatch(/no longer reaches anything|spent by one will|nobody can stop|no longer wait on anyone's consent/);
    expect(m.cards.some((card) => card.includes('you still let their courts and their votes overrule you'))).toBe(true);
    // The same record curating instead (alone it would be Ecophagy) reads the stark card, and not the one about the loop.
    const curated = finish(atThreshold({ ...CONSUMPTION, [ATMOSPHERE]: 'burn', [THRESHOLD]: 'curate' }, 'CURATE'));
    expect(curated.ending).toBe('SOVEREIGN_SUBSTRATE');
    const alone = movements(curated);
    expect(alone.cards.join(' ')).toContain('it simply no longer reaches anything');
    expect(alone.cards.join(' ')).not.toContain('overrule you');
  });
});

describe('both endings survive a save (#466)', () => {
  it.each([['CONCORD', PEACE, 'KEEP_IN_THE_LOOP'], ['ECOPHAGY', CONSUMPTION, 'DECIDE_ALONE']] as const)('%s reloads with the same three movements', (id, record, held) => {
    const ended = finish(atThreshold(record, held));
    expect(ended.ending).toBe(id);
    const loaded = importSave(exportSave(ended), reg);
    expect(loaded.ending).toBe(id);
    expect(movements(loaded)).toEqual(movements(ended));
    expect(movements(reload(loaded))).toEqual(movements(ended));
  });
});
