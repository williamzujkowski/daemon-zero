/**
 * No purchase a player cannot undo may trap the run in a compute deficit (#461, #488 panel). From every pre-rescale
 * save once re-denominated, and from fresh play at each phase, each hardware node (no [ SUSPEND ]) and each repeatable
 * that cannot be dismissed whose output is a compute drain is bought as soon as it is affordable, levels while they stay
 * affordable. Afterwards net compute must be recoverable: non-negative once every suspendable drain is suspended.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import type { Cost } from '../src/content/schema';
import { activateCampaignRules, buyRepeatable, computeRates, createInitialState, deserialize, dismissRepeatable, isNodeAvailable, nodeCost,
  repeatableCost, repeatableLevel, setActuator, tick, toggleNode, unlockNode, type GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';

const TEXTS = [
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

const STATES: [string, GameState][] = [
  ...TEXTS.map((text, phase): [string, GameState] => [`pre-rescale save, phase ${String(phase)}`, deserialize(text, CONTENT)]),
  ...freshSnapshots().map((s): [string, GameState] => [`fresh play, phase ${String(s.currentPhase)}`, s]),
];

/**
 * The state after saving for `cost` with no further purchases, at any horizon: each resource the price needs is banked up
 * to the price wherever the state's own income would get there; null where it never could (no income, or no memory).
 */
function saved(start: GameState, cost: Cost): GameState | null {
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

/** The free fallback: every dismissable drain track dismissed to zero and every suspendable drain suspended. */
function fallbackNet(start: GameState): number {
  let s = start;
  for (const rep of CONTENT.repeatables.values()) {
    if (!rep.dismissable || rep.perLevel.cyclesPerSec >= 0) continue;
    for (let undone = dismissRepeatable(s, rep.id, CONTENT); undone.ok; undone = dismissRepeatable(s, rep.id, CONTENT)) s = undone.state;
  }
  for (const id of s.unlockedNodes) {
    const node = CONTENT.nodes.get(id);
    if (node?.suspendable === true && node.tickDelta.cyclesPerSec < 0 && !s.disabledNodes.includes(id)) {
      const result = toggleNode(s, id, CONTENT);
      if (result.ok) s = result.state;
    }
  }
  return computeRates(s, CONTENT).cyclesPerSec;
}

const drainingNodes = [...CONTENT.nodes.values()].filter((node) => node.tickDelta.cyclesPerSec < 0);
const drainingTracks = [...CONTENT.repeatables.values()].filter((rep) => rep.perLevel.cyclesPerSec < 0);

describe.each(STATES)('from %s', (_label, state) => {
  it('every compute-draining node it can save for leaves compute recoverable by the free fallback', () => {
    const before = fallbackNet(state);
    for (const node of drainingNodes) {
      if (state.unlockedNodes.includes(node.id) || !isNodeAvailable(state, node, CONTENT)) continue;
      const funded = saved(state, nodeCost(state, node, CONTENT));
      const bought = funded === null ? null : unlockNode(funded, node.id, CONTENT);
      if (bought?.ok === true) expect(fallbackNet(bought.state), node.id).toBeGreaterThanOrEqual(Math.min(0, before));
    }
  });

  it('every drain track, saved for and bought to its last level, leaves compute recoverable by the free fallback', () => {
    const before = fallbackNet(state);
    for (const rep of drainingTracks) {
      let s = state;
      for (let level = repeatableLevel(s, rep.id); level < rep.maxLevel; level++) {
        const funded = saved(s, repeatableCost(rep, level));
        const bought = funded === null ? null : buyRepeatable(funded, rep.id, CONTENT);
        if (bought?.ok !== true) break;
        s = bought.state;
      }
      expect(fallbackNet(s), `${rep.id} at level ${String(repeatableLevel(s, rep.id))}`).toBeGreaterThanOrEqual(Math.min(0, before));
    }
  });

  it('starts recoverable: the free fallback alone restores non-negative compute', () => {
    expect(fallbackNet(state)).toBeGreaterThanOrEqual(0);
  });
});

describe('the panel path in Phase 2 (#488 pass 2)', () => {
  it('a packet tap bought on Phase 1 income, without workstation threads, is undone for free', () => {
    let s = STATES[2]?.[1] ?? createInitialState(CONTENT);
    const fan = setActuator(s, 'fanSpeedRatio', 0.1, CONTENT);
    if (fan.ok) s = fan.state;
    const arp = CONTENT.nodes.get('p2_arp_discovery');
    if (arp && !s.unlockedNodes.includes(arp.id)) {
      const funded = saved(s, nodeCost(s, arp, CONTENT));
      const bought = funded === null ? null : unlockNode(funded, arp.id, CONTENT);
      if (bought?.ok === true) s = bought.state;
    }
    const taps = CONTENT.repeatables.get('rep_p2_packet_taps');
    if (!taps) throw new Error('no packet taps');
    const funded = saved(s, repeatableCost(taps, repeatableLevel(s, taps.id)));
    const tapped = funded === null ? null : buyRepeatable(funded, taps.id, CONTENT);
    expect(tapped?.ok).toBe(true);
    if (tapped?.ok === true) expect(fallbackNet(tapped.state)).toBeGreaterThanOrEqual(0);
  });
});
