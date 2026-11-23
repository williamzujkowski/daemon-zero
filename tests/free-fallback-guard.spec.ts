/**
 * The free-fallback invariant as a property (#461, #488): no purchase may trap a constrained resource beyond what free
 * levers undo. From every pre-rescale save once re-denominated and from fresh careful play in each phase, every purchase
 * that carries a rate (a node, a track to its last level, a cohort forked to its cap, then pruned, clamped or elevated, a timed or lasting
 * action) is funded by saving at any horizon and bought; then the free fallback is pulled and every row must be out of
 * its trap. The bound: compute, capital, power, memory and understanding are out at once (their net rates are already
 * safe, so nothing gets worse from there); heat relaxes toward a steady state at or under the threshold with a time
 * constant of 1 / thermalDissipationPerSec (25 s); suspicion's own sources are at most zero, so natural decay alone takes
 * it from under the top rung to zero within suspicionRecoverySec() (4,300 s with the shipped ladder); a timed action's
 * output is judged once it has expired, at most its durationSec later.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { buyRepeatable, computeRates, executeShardCommand, forkShard, isNodeAvailable, nodeCost, performAction, repeatableCost, repeatableLevel,
  resolveWildEncounter, shardCommandCost, unlockNode, actionCost, type ActionResult, type GameState, type ShardCommand } from '../src/engine';
import type { HostileEncounter } from '../src/content/schemaHostile';
import { fixtureState, GUARD_STATES, pressedBy, saved } from './fallback-states';
import { freeFallback, suspicionRecoverySec, traps } from './free-fallback';

/** A purchase priced off the state it starts from: what it costs, and the act of buying it. */
type Purchase = { label: string; cost: (s: GameState) => Parameters<typeof saved>[1] | null; buy: (s: GameState) => ActionResult };

/** Buys `purchase` repeatedly, saving for each, until it is refused or `times` is reached. */
function buyUpTo(start: GameState, purchase: Purchase, times: number): GameState | null {
  let s = start, bought = false;
  for (let n = 0; n < times; n++) {
    const cost = purchase.cost(s);
    const funded = cost === null ? null : saved(s, cost);
    const result = funded === null ? null : purchase.buy(funded);
    if (result?.ok !== true) break;
    s = result.state; bought = true;
  }
  return bought ? s : null;
}

function purchases(s: GameState): [Purchase, number][] {
  const out: [Purchase, number][] = [];
  for (const node of CONTENT.nodes.values()) {
    if (isNodeAvailable(s, node, CONTENT)) out.push([{ label: node.id, cost: (st) => nodeCost(st, node, CONTENT), buy: (st) => unlockNode(st, node.id, CONTENT) }, 1]);
  }
  for (const rep of CONTENT.repeatables.values()) {
    out.push([{ label: rep.id, cost: (st) => repeatableCost(rep, repeatableLevel(st, rep.id)), buy: (st) => buyRepeatable(st, rep.id, CONTENT) }, rep.maxLevel]);
  }
  for (const template of CONTENT.swarm.playerSwarmTemplates) {
    out.push([{ label: `fork ${template.id}`, cost: () => template.cost, buy: (st) => forkShard(st, template.id, CONTENT) }, template.maxCount]);
  }
  for (const action of CONTENT.actions.values()) {
    if (!action.tickDelta) continue;
    out.push([{ label: action.id, cost: (st) => actionCost(st, action, CONTENT), buy: (st) => performAction(st, action.id, CONTENT) }, action.maxPurchases ?? 1]);
  }
  if (s.pendingWildEncounterId !== null) {
    out.push([{ label: `harness ${s.pendingWildEncounterId}`, cost: () => null, buy: (st) => resolveWildEncounter(st, 'HARNESS', CONTENT) }, 1]);
  }
  return out;
}

const COMMANDS: readonly ShardCommand[] = ['PRUNE', 'CLAMP', 'ELEVATE'];

/** Each purchase alone, then each cohort it leaves commanded (saved for) as well: every state a purchase can leave. */
function afterEach(start: GameState): [string, GameState][] {
  const out: [string, GameState][] = [];
  for (const [purchase, times] of purchases(start)) {
    // A purchase with no price (a harness) is taken as offered.
    const bought = purchase.cost(start) === null ? (() => { const r = purchase.buy(start); return r.ok ? r.state : null; })() : buyUpTo(start, purchase, times);
    if (bought === null) continue;
    out.push([purchase.label, bought]);
    for (const id of Object.keys(bought.activeShards)) {
      for (const command of COMMANDS) {
        const funded = saved(bought, shardCommandCost(bought, id, command, CONTENT));
        const commanded = funded === null ? null : executeShardCommand(funded, id, command, CONTENT);
        if (commanded?.ok === true) out.push([`${purchase.label}, then ${command} ${id}`, commanded.state]);
      }
    }
  }
  return out;
}

describe.each(GUARD_STATES)('from %s', (_label, state) => {
  it('starts out of every trap once the free fallback is pulled', () => {
    expect(traps(freeFallback(state))).toEqual([]);
  });

  it('every purchase it can save for leaves every resource out of its trap after the free fallback', () => {
    const trapped = afterEach(state).flatMap(([label, bought]) => traps(freeFallback(bought)).map((trap) => `${label} -> ${trap}`));
    expect(trapped).toEqual([]);
  });
});

const HOSTILE_STATES = GUARD_STATES.filter(([, state]) => state.currentPhase >= CONTENT.swarm.hostile.fromPhase)
  .flatMap(([label, state]) => CONTENT.swarm.hostileEncounters.filter((entry) => entry.tier === state.currentPhase)
    .map((encounter): [string, GameState, HostileEncounter] => [`${label}, ${encounter.type}`, state, encounter]));

describe('with a hostile mind pressing (#491)', () => {
  it('covers every hostile type in every phase it arrives in', () => {
    const phases = new Set(HOSTILE_STATES.map(([, state]) => state.currentPhase));
    expect([...phases].sort()).toEqual([...new Set(CONTENT.swarm.hostileEncounters.map((entry) => entry.tier))].sort());
  });

  it.each(HOSTILE_STATES)('from %s: the free fallback still leaves every resource out of its trap', (_label, state, encounter) => {
    expect(traps(freeFallback(pressedBy(state, encounter)))).toEqual([]);
  });

  it.each(HOSTILE_STATES)('from %s: so does every purchase it can save for', (_label, state, encounter) => {
    const trapped = afterEach(pressedBy(state, encounter)).flatMap(([label, bought]) => traps(freeFallback(bought)).map((trap) => `${label} -> ${trap}`));
    expect(trapped).toEqual([]);
  });
});

describe('the bound the guard states', () => {
  it('suspicion recovers from under the top rung within a bounded time: every rung below it decays', () => {
    const below = CONTENT.balance.escalation.slice(0, -1);
    for (const rung of below) expect(rung.decayMultiplier, `rung at ${String(rung.at)}`).toBeGreaterThan(0);
    expect(suspicionRecoverySec()).toBeLessThan(Infinity);
    expect(Math.round(suspicionRecoverySec())).toBe(4300);
  });
});

describe('the panel pass 3 reproduction: a clamped draining cohort in Phase 2', () => {
  /** The migrated Phase 2 save, saving 2.8e16 FLOP (about 4,360 s, no wipe), forks the syntax scrubber before ARP discovery and clamps it. */
  function clampedScrubber(): GameState {
    const template = CONTENT.swarm.playerSwarmTemplates.find((entry) => entry.forkable && entry.tickDelta.cyclesPerSec < 0);
    if (!template) throw new Error('no draining template');
    const start = fixtureState(2);
    expect(start.unlockedNodes).not.toContain('p2_arp_discovery');
    const funded = saved(start, template.cost);
    if (funded === null) throw new Error('the save cannot fund a fork');
    const forked = forkShard(funded, template.id, CONTENT);
    if (!forked.ok) throw new Error(forked.reason);
    const clamped = executeShardCommand(forked.state, template.id, 'CLAMP', CONTENT);
    if (!clamped.ok) throw new Error(clamped.reason);
    return clamped.state;
  }

  it('was a permanent brownout with the levers of 97d639f: suspending and dismissing everything left compute negative', () => {
    const before = freeFallback(clampedScrubber(), { withRelease: false });
    expect(computeRates(before, CONTENT).cyclesPerSec).toBeLessThan(0);
  });

  it('is undone for free now: RELEASE lets the clamped members go and every resource is out of its trap', () => {
    expect(traps(freeFallback(clampedScrubber()))).toEqual([]);
  });
});
