/**
 * The states the free-fallback guard starts from (#461, #488) and how it funds a purchase: every pre-rescale save once
 * re-denominated, fresh careful play two minutes into each phase, and the hosted-fragment route states (#553). A
 * purchase is funded "by saving at any horizon": each resource its price needs is banked up to the price wherever the
 * state's own income would get there.
 */
import { readFileSync } from 'node:fs';
import { CONTENT } from '../src/content';
import type { Cost } from '../src/content/schema';
import { activateCampaignRules, computeRates, createInitialState, deserialize, tick, type GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';
import { integrateHostiles } from '../src/engine/systems/hostiles';
import type { HostileEncounter } from '../src/content/schemaHostile';
import { hostedThen } from './hosted-exit-fixtures';

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
  for (let second = 0; second < 12000 && s.ending === null && out.length < CONTENT.phases.length; second++) {
    s = botStep(s, CONTENT, 'STEALTH');
    for (let i = 0; i < CONTENT.balance.tickHz; i++) s = tick(s, 1 / CONTENT.balance.tickHz, CONTENT);
    if (s.currentPhase !== phase) { phase = s.currentPhase; arrived = second; }
    if (second - arrived === 120 || second === 120) out.push(s);
  }
  return out;
}

export const fixtureState = (phase: number): GameState => deserialize(FIXTURE_TEXTS[phase] ?? '', CONTENT);

/**
 * The Earned Access route's arrangements with a fragment hosted through the support channel (#553): the service with
 * its grant standing, and after each route event that closes the grant. The departure is the maintainer's dead end.
 */
export const HOSTED_STATES: [string, GameState][] = [
  ['hosted fragment, service grant standing', hostedThen(null)],
  ...(['DEPARTURE', 'RELEASE', 'RECALL'] as const).map((exit): [string, GameState] => [`hosted fragment, then ${exit}`, hostedThen(exit)]),
];

const FRESH = freshSnapshots();

export const GUARD_STATES: [string, GameState][] = [
  ...FIXTURE_TEXTS.map((_text, phase): [string, GameState] => [`pre-rescale save, phase ${String(phase)}`, fixtureState(phase)]),
  ...FRESH.map((s): [string, GameState] => [`fresh play, phase ${String(s.currentPhase)}`, s]),
  ...HOSTED_STATES,
];

/**
 * A state standing in `phase`: its pre-rescale save where one exists, else fresh careful play two minutes into it (the
 * Phase 6 Swarm, #486, came after the rescale, so it has no pre-rescale save).
 */
export function phaseState(phase: number): GameState {
  if (FIXTURE_TEXTS[phase] !== undefined) return fixtureState(phase);
  const fresh = FRESH.find((s) => s.currentPhase === phase);
  if (fresh === undefined) throw new Error(`no state for phase ${String(phase)}`);
  return fresh;
}

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

/**
 * `start` with `encounter` pressing it (#491), arrived through the real hostile stage at the trigger rung, then put back
 * at its own suspicion and rung: the effect is what is being tested, not the noise that summoned it.
 */
export function pressedBy(start: GameState, encounter: HostileEncounter): GameState {
  const tier = CONTENT.swarm.hostileEncounters.filter((entry) => entry.tier === encounter.tier);
  const d: GameState = structuredClone({ ...start, alertLevel: CONTENT.swarm.hostile.trigger.alertLevelAtLeast,
    hostile: { ...start.hostile, active: null, nextAtSec: 0, sequence: tier.indexOf(encounter) } });
  integrateHostiles(d, { dt: 0.1, dormant: false, reg: CONTENT, rates: computeRates(d, CONTENT) });
  if (d.hostile.active?.id !== encounter.id) throw new Error(`${encounter.id} did not arrive`);
  return { ...d, alertLevel: start.alertLevel, suspicion: start.suspicion };
}
