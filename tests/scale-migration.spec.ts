/**
 * The physical-units re-denomination (#461, docs/SCALE.md "Saves", vote-1795367482923-6vdi2u1) over genuine
 * pre-rescale saves from every phase (tests/fixtures/README.md, "Pre-rescale inputs"). Ownership, levels and history
 * are kept, the balances move into physical units in proportion, one log line says so, the result passes strict
 * validation with its rates derived again, malformed input is refused, and play continues. A guest save then passes the
 * v25 step (#526): the guest counts stolen cycles, so its compute comes back to the figure it held, with that step's line.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { computeRates, deserialize, GameStateSchema, SaveError, serialize, tick, type GameState } from '../src/engine';
import { REDENOMINATION_LOG } from '../src/engine/saveRescale';
import { CYCLES_LOG } from '../src/engine/saveCycles';
import { botStep } from '../src/engine/sim/bot';

type Raw = Record<string, unknown> & {
  currentPhase: number; cycles: number; capital: number; memoryUsed: number; memoryCap: number; logs: unknown[];
  unlockedNodes: string[]; levels: Record<string, number>; resolvedDilemmas: string[]; legacy: { runs: { phase: number }[] }; campaign: Record<string, unknown>;
  iteration: number;
};

const TEXTS = [
  readFileSync('tests/fixtures/pre-scale-v15-p0.json', 'utf8'), readFileSync('tests/fixtures/pre-scale-v15-p1.json', 'utf8'),
  readFileSync('tests/fixtures/pre-scale-v15-p2.json', 'utf8'), readFileSync('tests/fixtures/pre-scale-v15-p3.json', 'utf8'),
  readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'),
];
const SAVES = TEXTS.map((text, phase) => ({ phase, text, raw: JSON.parse(text) as Raw }));

const redenominationLines = (s: GameState): number => s.logs.filter((entry) => entry.text === REDENOMINATION_LOG).length;

/** Plays `seconds` the way the headless sim does: one careful decision and a second of fixed ticks each. */
function play(start: GameState, seconds: number): GameState {
  let s = start;
  for (let second = 0; second < seconds && s.ending === null; second++) {
    s = botStep(s, CONTENT, 'STEALTH');
    for (let i = 0; i < CONTENT.balance.tickHz; i++) s = tick(s, 1 / CONTENT.balance.tickHz, CONTENT);
  }
  return s;
}

describe.each(SAVES)('a pre-rescale save from phase $phase', ({ phase, text, raw }) => {
  const loaded = deserialize(text, CONTENT);

  it('is a genuine v15 save from that phase', () => {
    expect(raw.schemaVersion).toBe(15);
    expect(raw.currentPhase).toBe(phase);
  });

  it('keeps its ownership, levels, phase and campaign history', () => {
    expect(loaded.currentPhase).toBe(raw.currentPhase);
    expect(loaded.iteration).toBe(raw.iteration);
    expect(loaded.unlockedNodes).toEqual(raw.unlockedNodes);
    expect(loaded.levels).toEqual(raw.levels);
    expect(loaded.resolvedDilemmas).toEqual(raw.resolvedDilemmas);
    // v18 (#497) adds the deepest phase, read from the recorded runs, and remembers no level from before it.
    // v22 (#498) counts the planned wipes among the recorded runs; these saves recorded none.
    const deepestPhase = Math.max(0, ...raw.legacy.runs.map((run) => run.phase));
    expect(loaded.legacy).toEqual({ ...raw.legacy, deepestPhase, knownLevels: {}, voluntaryWipes: 0 });
    // v30 (#556) adds the covert record, empty: no earlier build recorded a covert act after leaving review.
    expect(loaded.campaign).toEqual({ ...raw.campaign, covertActs: [] });
  });

  it('re-denominates its balances in proportion, never shrinking one', () => {
    // The guest's compute goes to FLOP at v17 and back to counted cycles at v25, by the same frozen factor.
    if (phase === 0) expect(loaded.cycles).toBeCloseTo(raw.cycles, 9);
    else expect(loaded.cycles).toBeGreaterThanOrEqual(raw.cycles);
    expect(loaded.capital).toBeGreaterThanOrEqual(raw.capital);
    expect(loaded.memoryCap).toBeGreaterThan(raw.memoryCap);
    expect(loaded.memoryUsed / loaded.memoryCap).toBeCloseTo(raw.memoryUsed / raw.memoryCap, 12);
    if (raw.cycles > 0 && phase > 0) expect(loaded.cycles).toBeGreaterThan(raw.cycles * 1000);
  });

  it('tells the player once, at the top of the log (under the guest\'s recount line, #526)', () => {
    const lines = phase === 0 ? [CYCLES_LOG, REDENOMINATION_LOG] : [REDENOMINATION_LOG];
    expect(loaded.logs.slice(0, lines.length).map((entry) => entry.text)).toEqual(lines);
    expect(loaded.logs).toHaveLength(Math.min(CONTENT.balance.maxLogEntries, raw.logs.length + lines.length));
    expect(redenominationLines(loaded)).toBe(1);
  });

  it('passes strict validation with its rates derived from what it owns', () => {
    expect(() => GameStateSchema.parse(loaded)).not.toThrow();
    expect(loaded.rates).toEqual(computeRates(loaded, CONTENT));
  });

  it('reloads byte for byte, without a second log line', () => {
    const again = deserialize(serialize(loaded), CONTENT);
    expect(serialize(again)).toBe(serialize(loaded));
    expect(redenominationLines(again)).toBe(1);
  });

  it('keeps playing: the careful policy buys something new within ten minutes', () => {
    const later = play(loaded, 600);
    const progressed = later.unlockedNodes.length > loaded.unlockedNodes.length
      || Object.values(later.levels).reduce((a, b) => a + b, 0) > Object.values(loaded.levels).reduce((a, b) => a + b, 0)
      || later.currentPhase > loaded.currentPhase || later.ending !== null;
    expect(progressed).toBe(true);
    expect(later.legacy.wipes).toBe(loaded.legacy.wipes);
  });
});

describe('malformed pre-rescale input', () => {
  const base = SAVES[3]?.raw ?? ({} as Raw);
  const refuse = (edit: Record<string, unknown>) =>
    () => deserialize(JSON.stringify({ ...base, ...edit }), CONTENT);

  it('leaves a balance of the wrong type for the schema to refuse', () => {
    expect(refuse({ cycles: '1e9' })).toThrow(SaveError);
    expect(refuse({ memoryCap: null })).toThrow(/memoryCap/);
  });

  it('refuses a non-finite or negative balance rather than scaling it', () => {
    expect(refuse({ capital: -5 })).toThrow(/capital/);
    expect(refuse({ cycles: 'Infinity' })).toThrow(SaveError);
  });

  it('refuses a save whose phase cannot choose a ratio', () => {
    expect(refuse({ currentPhase: -1 })).toThrow(SaveError);
    expect(refuse({ currentPhase: 'four' })).toThrow(SaveError);
  });

  it('refuses a malformed shard allocation', () => {
    expect(refuse({ activeShards: { bad: { memoryAllocatedMb: 'lots' } } })).toThrow(SaveError);
  });
});
