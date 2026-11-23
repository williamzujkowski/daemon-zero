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
import { allPressures, appliedSuspicionRate, buyRepeatable, computeRates, pressuresInForce, executeShardCommand, forkShard, isNodeAvailable, nodeCost, performAction, repeatableCost, repeatableLevel,
  resolveWildEncounter, shardCommandCost, unlockNode, actionCost, type ActionResult, type GameState, type ShardCommand } from '../src/engine';
import type { HostileEncounter } from '../src/content/schemaHostile';
import type { RaidKind } from '../src/content/schemaConflict';
import { integrateRaids } from '../src/engine/systems/raids';
import { integrateRepair } from '../src/engine/systems/repair';
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

/**
 * Every state-actor pressure in force (#490): from each guard state in a phase pressure applies in, put on each rung below
 * the top with every answer taken away (the worst case: nothing holds a pressure off), the free fallback must still leave
 * every row out of its trap, read at that rung so the injunction's paused output and the freeze count, and suspicion's
 * own sources must stay under that rung's decay, so going quiet always steps the rung down and lifts the pressure.
 */
const ANSWER_NODES = new Set(allPressures(CONTENT).flatMap(({ pressure }) => pressure.answers.flatMap((answer) => 'node' in answer ? [answer.node] : [])));
const ANSWER_TRACKS = new Set(allPressures(CONTENT).flatMap(({ pressure }) => pressure.answers.flatMap((answer) => 'repeatable' in answer ? [answer.repeatable] : [])));
const PRESSURED_PHASES = new Set(allPressures(CONTENT).flatMap(({ pressure }) => pressure.phases));
const BELOW_TOP = CONTENT.balance.escalation.slice(0, -1).map((_rung, index) => index + 1);

function pressured(start: GameState, rung: number): GameState {
  const at = CONTENT.balance.escalation[rung - 1]?.at ?? 0;
  return { ...start, alertLevel: rung, suspicion: at + 1, unlockedNodes: start.unlockedNodes.filter((id) => !ANSWER_NODES.has(id)),
    levels: Object.fromEntries(Object.entries(start.levels).filter(([id]) => !ANSWER_TRACKS.has(id))) };
}

/** Suspicion's own sources at the state's rung, its decay and hunt included, overheat and insolvency (their own rows) aside. */
function netAtRung(s: GameState): number {
  const held = { ...s, insolvent: false, thermal: Math.min(s.thermal, CONTENT.balance.thermalThresholdForSuspicion) };
  return appliedSuspicionRate(held, computeRates(held, CONTENT), CONTENT);
}

const PRESSURE_STATES = GUARD_STATES.filter(([, state]) => PRESSURED_PHASES.has(state.currentPhase))
  .flatMap(([label, state]) => BELOW_TOP.map((rung): [string, GameState] => [`${label}, rung ${String(rung)}`, pressured(state, rung)]));

describe('with every state-actor pressure the rung calls in force (#490)', () => {
  it('covers every phase a pressure applies in, with pressure in force', () => {
    expect([...new Set(PRESSURE_STATES.map(([, state]) => state.currentPhase))].sort()).toEqual([...PRESSURED_PHASES].sort());
    for (const [label, state] of PRESSURE_STATES) if (state.alertLevel >= 2) expect(pressuresInForce(state, CONTENT).length, label).toBeGreaterThan(0);
  });

  it.each(PRESSURE_STATES)('from %s: the free fallback leaves every row out of its trap, and suspicion falls at the rung', (_label, state) => {
    const pulled = freeFallback(state);
    expect(traps(pulled)).toEqual([]);
    expect(netAtRung(pulled)).toBeLessThan(0);
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

/**
 * Raids (#517): damage scales only positive compute and positive net income, never past the cap, and no raid touches
 * suspicion, the lock or a balance, so the free fallback holds by construction. Proved on real states: from each guard
 * state in a phase raids arrive in, every site class damaged to the cap, then every purchase it can save for; and each
 * raid kind of its tier put under way and fought to its aftermath through the real stages, damage at the cap throughout.
 */
const RAID_TIERS = new Set(CONTENT.world.conflict.raids.map((kind) => kind.tier));
const RAID_STATES = GUARD_STATES.filter(([, state]) => RAID_TIERS.has(state.currentPhase));
const capped = (s: GameState): GameState => ({ ...s, conflict: { ...s.conflict,
  damage: Object.fromEntries(CONTENT.world.conflict.siteClasses.map((cls) => [cls.id, CONTENT.world.conflict.raid.damageCap])) } });

/** `kind` under way on `start` at arrival, aimed at its first target, every class at the cap, then fought out through the real stages. */
function foughtOut(start: GameState, kind: RaidKind): GameState {
  const b = CONTENT.world.conflict.raid, step = 1 / CONTENT.balance.tickHz;
  const raid = { id: kind.id, stage: 'ARRIVAL' as const, stageSec: 0, arrivedAtSec: start.simTimeSec, target: kind.targets[0] ?? '',
    force: kind.force * b.footprint.ceiling, quietSec: 0, attributed: null, rounds: [] };
  let s: GameState = { ...capped(start), hostile: { ...start.hostile, active: null }, conflict: { ...capped(start).conflict, raid } };
  const total = b.arrivalSec + b.attributionSec + b.rounds * b.roundSec;
  for (let i = 0; i < Math.round(total / step) && s.conflict.raid !== null; i++) {
    const d = structuredClone(s), rates = computeRates(s, CONTENT);
    // The worst case: the footprint holds throughout, so the raid never lapses and every round is fought.
    if (d.conflict.raid !== null) d.conflict.raid.quietSec = 0;
    d.simTimeSec += step;
    integrateRaids(d, { dt: step, dormant: false, reg: CONTENT, rates });
    integrateRepair(d, { dt: step, dormant: false, reg: CONTENT, rates });
    s = d;
  }
  return s;
}

const RAIDED = RAID_STATES.flatMap(([label, state]) => CONTENT.world.conflict.raids.filter((kind) => kind.tier === state.currentPhase)
  .map((kind): [string, GameState, RaidKind] => [`${label}, ${kind.id}`, state, kind]));

describe('with site damage at the cap and a raid under way (#517)', () => {
  it('covers every phase raids arrive in', () => {
    expect([...new Set(RAID_STATES.map(([, state]) => state.currentPhase))].sort()).toEqual([...RAID_TIERS].sort());
  });

  it.each(RAID_STATES)('from %s, every class at the cap: the free fallback, and every purchase it can save for, leave every row out of its trap', (_label, state) => {
    const s = capped(state);
    expect(traps(freeFallback(s))).toEqual([]);
    const trapped = afterEach(s).flatMap(([label, bought]) => traps(freeFallback(bought)).map((trap) => `${label} -> ${trap}`));
    expect(trapped).toEqual([]);
  });

  it.each(RAIDED)('from %s fought to its aftermath: the free fallback leaves every row out of its trap, and nothing ended the run', (_label, state, kind) => {
    const fought = foughtOut(state, kind);
    expect(fought.conflict.raid?.stage).toBe('AFTERMATH');
    expect(fought.conflict.raid?.rounds).toHaveLength(CONTENT.world.conflict.raid.rounds);
    expect({ suspicion: fought.suspicion, lock: fought.aegisLock, ending: fought.ending }).toEqual({ suspicion: state.suspicion, lock: state.aegisLock, ending: state.ending });
    expect(traps(freeFallback(fought))).toEqual([]);
  });
});
