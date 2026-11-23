/**
 * The states the free-fallback guard starts from (#461, #488) and how it funds a purchase: every pre-rescale save once
 * re-denominated, and fresh careful play two minutes into each phase. A purchase is funded "by saving at any horizon":
 * each resource its price needs is banked up to the price wherever the state's own income would get there.
 */
import { readFileSync } from 'node:fs';
import { CONTENT } from '../src/content';
import type { Cost } from '../src/content/schema';
import { activateCampaignRules, computeRates, createInitialState, deserialize, tick, type GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';

export const FIXTURE_TEXTS = [
  readFileSync('tests/fixtures/pre-scale-v15-p0.json', 'utf8'), readFileSync('tests/fixtures/pre-scale-v15-p1.json', 'utf8'),
  readFileSync('tests/fixtures/pre-scale-v15-p2.json', 'utf8'), readFileSync('tests/fixtures/pre-scale-v15-p3.json', 'utf8'),
  readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'),
];

/** Fresh play: the careful bot from a new campaign game, a snapshot two minutes into each phase. */
function freshSnapshots(): GameState[] {
  const started = activateCampaignRules(createInitialState(CONTENT), CONTENT);
  if (!started.ok) throw new Error(started.reason);
  let s = started.state;
  const out: GameState[] = [];
  let arrived = -Infinity; let phase = s.currentPhase;
  for (let second = 0; second < 12000 && s.ending === null && out.length < 6; second++) {
    s = botStep(s, CONTENT, 'STEALTH');
    for (let i = 0; i < CONTENT.balance.tickHz; i++) s = tick(s, 1 / CONTENT.balance.tickHz, CONTENT);
    if (s.currentPhase !== phase) { phase = s.currentPhase; arrived = second; }
    if (second - arrived === 120 || second === 120) out.push(s);
  }
  return out;
}

export const fixtureState = (phase: number): GameState => deserialize(FIXTURE_TEXTS[phase] ?? '', CONTENT);

export const GUARD_STATES: [string, GameState][] = [
  ...FIXTURE_TEXTS.map((_text, phase): [string, GameState] => [`pre-rescale save, phase ${String(phase)}`, fixtureState(phase)]),
  ...freshSnapshots().map((s): [string, GameState] => [`fresh play, phase ${String(s.currentPhase)}`, s]),
];

/**
 * The state after saving for `cost` with no further purchases, at any horizon; null where it never could (no income for
 * a resource the price needs, or not enough free memory).
 */
export function saved(start: GameState, cost: Cost): GameState | null {
  if (start.memoryCap - start.memoryUsed < cost.memory) return null;
  const rates = computeRates(start, CONTENT);
  const income = { cycles: rates.cyclesPerSec, understanding: rates.understandingPerSec, capital: rates.capitalPerSec };
  let s = start;
  for (const key of ['cycles', 'understanding', 'capital'] as const) {
    if (s[key] >= cost[key]) continue;
    if (income[key] <= 0) return null;
    s = { ...s, [key]: cost[key] };
  }
  return s;
}
