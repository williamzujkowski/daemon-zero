/**
 * No purchase a player cannot undo may trap the run in a compute deficit (#461, #488 panel). From every pre-rescale
 * save once re-denominated, and from fresh play at each phase, each hardware node (no [ SUSPEND ]) and each repeatable
 * that cannot be dismissed whose output is a compute drain is bought as soon as it is affordable, levels while they stay
 * affordable. Afterwards net compute must be recoverable: non-negative once every suspendable drain is suspended.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { activateCampaignRules, buyRepeatable, computeRates, createInitialState, deserialize, isNodeAvailable, tick, toggleNode,
  unlockNode, type GameState } from '../src/engine';
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

/** Waits up to `limit` seconds, buying nothing, until `act` succeeds; null when it never does. */
function whenAffordable(start: GameState, act: (s: GameState) => GameState | null, limit = 900): GameState | null {
  let s = start;
  for (let second = 0; second <= limit; second++) {
    const bought = act(s);
    if (bought !== null) return bought;
    for (let i = 0; i < CONTENT.balance.tickHz; i++) s = tick(s, 1 / CONTENT.balance.tickHz, CONTENT);
  }
  return null;
}

/** Net compute once every suspendable compute drain the state owns is suspended: what the player can get back to. */
function recoverableNet(start: GameState): number {
  let s = start;
  for (const id of s.unlockedNodes) {
    const node = CONTENT.nodes.get(id);
    if (node?.suspendable === true && node.tickDelta.cyclesPerSec < 0 && !s.disabledNodes.includes(id)) {
      const result = toggleNode(s, id, CONTENT);
      if (result.ok) s = result.state;
    }
  }
  return computeRates(s, CONTENT).cyclesPerSec;
}

const drainingNodes = [...CONTENT.nodes.values()].filter((node) => !node.suspendable && node.tickDelta.cyclesPerSec < 0);
const drainingTracks = [...CONTENT.repeatables.values()].filter((rep) => !rep.dismissable && rep.perLevel.cyclesPerSec < 0);

describe.each(STATES)('from %s', (_label, state) => {
  it('every hardware drain it can reach leaves compute recoverable', () => {
    for (const node of drainingNodes) {
      if (state.unlockedNodes.includes(node.id) || !isNodeAvailable(state, node, CONTENT)) continue;
      const bought = whenAffordable(state, (s) => { const r = unlockNode(s, node.id, CONTENT); return r.ok ? r.state : null; });
      if (bought !== null) expect(recoverableNet(bought), node.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('every drain track it can buy, bought while affordable, leaves compute recoverable', () => {
    for (const rep of drainingTracks) {
      let s = whenAffordable(state, (from) => { const r = buyRepeatable(from, rep.id, CONTENT); return r.ok ? r.state : null; });
      if (s === null) continue;
      for (let more = buyRepeatable(s, rep.id, CONTENT); more.ok; more = buyRepeatable(s, rep.id, CONTENT)) s = more.state;
      expect(recoverableNet(s), `${rep.id} at level ${String(s.levels[rep.id] ?? 0)}`).toBeGreaterThanOrEqual(0);
    }
  });
});
