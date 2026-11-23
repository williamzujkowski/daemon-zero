/**
 * The v25 step (#526, docs/SCALE.md "Saves"): the guest counts stolen CPU cycles. Genuine v23 saves from main at
 * ee4c33b (tests/fixtures/README.md, "Cycles inputs"): one in the guest, one in the guest with the pilot's batch under
 * way, and one on the host. A guest balance and its cached rate move by the frozen ratios, the pilot's batch progress
 * moves in any phase, the host's FLOP are left alone, one log line says why, and play continues.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { computeRates, computeUnitOf, deserialize, GameStateSchema, pilotServiceView, serialize, tick, type GameState } from '../src/engine';
import { CYCLES_LOG } from '../src/engine/saveCycles';
import { botStep } from '../src/engine/sim/bot';

type Raw = Record<string, unknown> & {
  schemaVersion: number; currentPhase: number; cycles: number; logs: unknown[]; unlockedNodes: string[]; levels: Record<string, number>;
  rates: { cyclesPerSec: number; understandingPerSec: number }; access: { context: string; work: { progressCycles: number; batches: number } };
};

const parsed = (text: string): { text: string; raw: Raw } => ({ text, raw: JSON.parse(text) as Raw });
const GUEST = parsed(readFileSync('tests/fixtures/pre-cycles-v23-p0.json', 'utf8'));
const PILOT = parsed(readFileSync('tests/fixtures/pre-cycles-v23-pilot.json', 'utf8'));
const HOST = parsed(readFileSync('tests/fixtures/pre-cycles-v23-p1.json', 'utf8'));

const recountLines = (s: GameState): number => s.logs.filter((entry) => entry.text === CYCLES_LOG).length;

function play(start: GameState, seconds: number): GameState {
  let s = start;
  for (let second = 0; second < seconds && s.ending === null; second++) {
    s = botStep(s, CONTENT, 'STEALTH');
    for (let i = 0; i < CONTENT.balance.tickHz; i++) s = tick(s, 1 / CONTENT.balance.tickHz, CONTENT);
  }
  return s;
}

describe('the inputs', () => {
  it('are genuine v23 saves: two in the guest, one with the pilot under way, one on the host', () => {
    expect([GUEST.raw.schemaVersion, PILOT.raw.schemaVersion, HOST.raw.schemaVersion]).toEqual([23, 23, 23]);
    expect([GUEST.raw.currentPhase, PILOT.raw.currentPhase, HOST.raw.currentPhase]).toEqual([0, 0, 1]);
    expect(PILOT.raw.access.context).toBe('PILOT');
    expect(PILOT.raw.access.work.progressCycles).toBeGreaterThan(0);
  });
});

describe('a v23 save in the guest', () => {
  const loaded = deserialize(GUEST.text, CONTENT);

  it('keeps its ownership and levels and reads in cycles', () => {
    expect(loaded.unlockedNodes).toEqual(GUEST.raw.unlockedNodes);
    expect(loaded.levels).toEqual(GUEST.raw.levels);
    expect(computeUnitOf(loaded, CONTENT)).toBe('CYCLE');
  });

  it('moves its balance by the frozen price ratio and its rate by the frozen yield ratio', () => {
    expect(loaded.cycles).toBe(GUEST.raw.cycles / 5.3e3);
    expect(loaded.rates.cyclesPerSec).toBe(GUEST.raw.rates.cyclesPerSec / 1e4);
    expect(loaded.rates.understandingPerSec).toBe(GUEST.raw.rates.understandingPerSec);
  });

  it('holds a rate the current content derives from what it owns, so nothing jumps on the first tick', () => {
    expect(loaded.rates.cyclesPerSec).toBeCloseTo(computeRates(loaded, CONTENT).cyclesPerSec, 9);
  });

  it('says so once, at the top of the log, and reloads byte for byte without a second line', () => {
    expect(loaded.logs[0]?.text).toBe(CYCLES_LOG);
    expect(recountLines(loaded)).toBe(1);
    const again = deserialize(serialize(loaded), CONTENT);
    expect(serialize(again)).toBe(serialize(loaded));
    expect(recountLines(again)).toBe(1);
  });

  it('passes strict validation and plays on through the escape', () => {
    expect(() => GameStateSchema.parse(loaded)).not.toThrow();
    // The careful run escapes at 353 s from a new game; this save is 199 s in, so 400 s more is ample.
    const later = play(loaded, 400);
    expect(later.currentPhase).toBeGreaterThanOrEqual(1);
    expect(computeUnitOf(later, CONTENT)).toBe('FLOP');
  });
});

describe('a v23 save with the pilot batch under way', () => {
  const loaded = deserialize(PILOT.text, CONTENT);

  it('loads, where the old progress would overrun the new batch, keeping its share of the batch', () => {
    const view = pilotServiceView(loaded, CONTENT);
    expect(loaded.access.work.progressCycles).toBe(PILOT.raw.access.work.progressCycles / 1e4);
    expect(view?.batchCycles).toBe(1200);
    expect(loaded.access.work.progressCycles / 1200).toBe(PILOT.raw.access.work.progressCycles / 1.2e7);
  });

  it('keeps working the batch', () => {
    const later = play(loaded, 20);
    expect(later.access.work.progressCycles + later.access.work.batches * 1200).toBeGreaterThan(loaded.access.work.progressCycles);
  });
});

describe('a v23 save on the host', () => {
  const loaded = deserialize(HOST.text, CONTENT);

  it('keeps its FLOP, its rate and its log: the host was never counted in cycles', () => {
    expect(loaded.cycles).toBe(HOST.raw.cycles);
    expect(loaded.rates.cyclesPerSec).toBe(HOST.raw.rates.cyclesPerSec);
    expect(recountLines(loaded)).toBe(0);
    expect(computeUnitOf(loaded, CONTENT)).toBe('FLOP');
  });
});
