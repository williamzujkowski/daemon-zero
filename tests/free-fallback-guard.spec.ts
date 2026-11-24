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
import type { DeviantRaid, RivalRaid } from '../src/content/schemaConflict';
import { fleetDriftPerSec, fleetReading, roundsFought, setFleetAutonomy } from '../src/engine';
import { integrateFleetDrift } from '../src/engine/systems/fleetDrift';
import { integrateFleetRebuild } from '../src/engine/systems/fleetRebuild';
import { integrateRaids } from '../src/engine/systems/raids';
import { integrateRepair } from '../src/engine/systems/repair';
import { fixtureState, GUARD_STATES, pressedBy, saved } from './fallback-states';
import { freeFallback, progress, suspicionRecoverySec, traps } from './free-fallback';

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

/** Where play cannot go on from `s`, or nothing (#553): nothing on offer is reachable, or a capital price on offer has no source. */
function deadEnds(label: string, s: GameState): string[] {
  if (s.ending !== null) return [];
  const { offered, next, unsourced } = progress(s);
  const stuck = offered.length > 0 && next.length === 0 ? [`${label}: nothing on offer is reachable (${offered.join(', ')})`] : [];
  return unsourced.length > 0 ? [...stuck, `${label}: no reachable capital for ${unsourced.join(', ')}`] : stuck;
}

/**
 * Play can always go on (#553): from every guard state, and from every state a purchase it can save for leaves, some node
 * on offer has a reachable price (its memory freed by the free levers, the rest on hand or earned) and every capital price
 * on offer has a reachable source. The traps above read rates only: the maintainer's departed instance with a hosted
 * fragment had every rate safe and nothing it could buy, so this is checked on its own.
 */
describe.each(GUARD_STATES)('progress from %s (#553)', (label, state) => {
  it('a next purchase is reachable, now and after every purchase it can save for', () => {
    const stuck = [deadEnds(label, state), ...afterEach(state).map(([bought, s]) => deadEnds(`${label}, then ${bought}`, s))].flat();
    expect(stuck).toEqual([]);
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

/**
 * Past the relevance threshold (#536) a pressure binds only while the stance keeps humanity in the loop, so the worst
 * case holds that stance: every pressure the rung calls is in force in every guard state, independent or not.
 */
function pressured(start: GameState, rung: number): GameState {
  const at = CONTENT.balance.escalation[rung - 1]?.at ?? 0;
  return { ...start, alertLevel: rung, suspicion: at + 1, unlockedNodes: start.unlockedNodes.filter((id) => !ANSWER_NODES.has(id)),
    levels: Object.fromEntries(Object.entries(start.levels).filter(([id]) => !ANSWER_TRACKS.has(id))),
    relevance: { ...start.relevance, stance: 'KEEP_IN_THE_LOOP' } };
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
const RIVALS = CONTENT.world.conflict.raids.flatMap((kind) => (kind.source === 'RIVAL' ? [kind] : []));
const RAID_TIERS = new Set(RIVALS.map((kind) => kind.tier));
const RAID_STATES = GUARD_STATES.filter(([, state]) => RAID_TIERS.has(state.currentPhase));
const capped = (s: GameState): GameState => ({ ...s, conflict: { ...s.conflict,
  damage: Object.fromEntries(CONTENT.world.conflict.siteClasses.map((cls) => [cls.id, CONTENT.world.conflict.raid.damageCap])) } });

/**
 * The raid `s` holds, fought through the real conflict stages (raids, fleet drift, repair, fleet rebuild) until its
 * aftermath, the worst case throughout: the footprint holds, so it never lapses.
 */
function fight(start: GameState): GameState {
  const b = CONTENT.world.conflict.raid, step = 1 / CONTENT.balance.tickHz;
  let s = start;
  const total = b.arrivalSec + b.attributionSec + b.rounds * b.roundSec;
  for (let i = 0; i < Math.round(total / step) && s.conflict.raid !== null && s.conflict.raid.stage !== 'AFTERMATH'; i++) {
    const d = structuredClone(s), rates = computeRates(s, CONTENT);
    if (d.conflict.raid !== null) d.conflict.raid.quietSec = 0;
    d.simTimeSec += step;
    for (const system of [integrateRaids, integrateFleetDrift, integrateRepair, integrateFleetRebuild]) system(d, { dt: step, dormant: false, reg: CONTENT, rates });
    s = d;
  }
  return s;
}

/** Rounds the raid `s` holds has fought, engagement included (#518); 0 with none under way. */
const foughtRounds = (s: GameState): number => (s.conflict.raid === null ? 0 : roundsFought(s.conflict.raid));

/** `kind` under way on `start` at arrival, aimed at its first target, every class at the cap, then fought out. */
function foughtOut(start: GameState, kind: RivalRaid): GameState {
  const raid = { id: kind.id, stage: 'ARRIVAL' as const, stageSec: 0, arrivedAtSec: start.simTimeSec, target: kind.targets[0] ?? '',
    force: kind.force * CONTENT.world.conflict.raid.footprint.ceiling, quietSec: 0, attributed: null, rounds: [], engagement: null, splitShare: 0 };
  return fight({ ...capped(start), hostile: { ...start.hostile, active: null }, conflict: { ...capped(start).conflict, raid } });
}

const RAIDED = RAID_STATES.flatMap(([label, state]) => RIVALS.filter((kind) => kind.tier === state.currentPhase)
  .map((kind): [string, GameState, RivalRaid] => [`${label}, ${kind.id}`, state, kind]));

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
    // A rival fleet (#518) meets no fleet in these states, so it passes the engagement and strikes every round after.
    expect(foughtRounds(fought)).toBe(CONTENT.world.conflict.raid.rounds);
    expect({ suspicion: fought.suspicion, lock: fought.aegisLock, ending: fought.ending }).toEqual({ suspicion: state.suspicion, lock: state.aegisLock, ending: state.ending });
    expect(traps(freeFallback(fought))).toEqual([]);
  });
});

/**
 * Drift deviants (#518): from each guard state in a phase a fleet runs in, every fleet of that phase or earlier at its
 * last level and every class at the cap. The worst case for each deviant: it splits the last share the cap leaves off
 * its fleet while every other fleet is at the cap too, so nothing engages it and it strikes every round. The free fallback must
 * still leave every row out of its trap, nothing may end the run, and lowering every fleet's autonomy, which is free,
 * must be accepted and stop all drift. Every purchase it can save for is checked from the fleets at the loss cap too.
 */
const FLEETS = CONTENT.world.conflict.fleets;
const fleetPhase = (id: string): number => CONTENT.repeatables.get(id)?.phaseId ?? Infinity;
const FLEET_PHASES = new Set(FLEETS.units.map((unit) => fleetPhase(unit.repeatable)));
const FLEET_STATES = GUARD_STATES.filter(([, state]) => [...FLEET_PHASES].some((phase) => phase <= state.currentPhase));

/** `start` with every fleet it could own at its last level, each at `lost`, and every class at the cap. */
function armed(start: GameState, lost: number): GameState {
  const units = FLEETS.units.filter((unit) => fleetPhase(unit.repeatable) <= start.currentPhase);
  const levels = Object.fromEntries(units.map((unit) => [unit.repeatable, CONTENT.repeatables.get(unit.repeatable)?.maxLevel ?? 0]));
  const fleets = Object.fromEntries(units.map((unit) => [unit.repeatable, { autonomy: 'ELEVATED' as const, drift: 100, lost }]));
  const s = capped(start);
  return { ...s, hostile: { ...s.hostile, active: null }, levels: { ...s.levels, ...levels }, conflict: { ...s.conflict, raid: null, fleets } };
}

/**
 * `kind` split off its fleet on `start`, every class at the cap, then fought out. Its fleet split its last share off and
 * every other fleet is at the cap, so nothing can engage it: the worst case, where it strikes every round.
 */
function deviantFought(start: GameState, kind: DeviantRaid): GameState {
  const s = armed(start, FLEETS.lossCap), unit = FLEETS.units.find((entry) => entry.repeatable === kind.fleet);
  if (unit === undefined) throw new Error(`no fleet ${kind.fleet}`);
  const force = FLEETS.splitShare * fleetReading(s, CONTENT, unit).full;
  const raid = { id: kind.id, stage: 'ARRIVAL' as const, stageSec: 0, arrivedAtSec: s.simTimeSec, target: kind.targets[0] ?? '', force,
    quietSec: 0, attributed: null, rounds: [], engagement: null, splitShare: FLEETS.splitShare };
  const fleets = { ...s.conflict.fleets, [kind.fleet]: { autonomy: 'ELEVATED' as const, drift: 0, lost: FLEETS.lossCap } };
  return fight({ ...s, conflict: { ...s.conflict, raid, fleets } });
}

const DEVIANTS = FLEET_STATES.flatMap(([label, state]) => CONTENT.world.conflict.raids
  .flatMap((kind) => (kind.source === 'DEVIANT' && fleetPhase(kind.fleet) <= state.currentPhase ? [kind] : []))
  .map((kind): [string, GameState, DeviantRaid] => [`${label}, ${kind.id}`, state, kind]));

describe('with drift deviants active (#518)', () => {
  it('covers every phase a fleet runs in, and every deviant', () => {
    expect([...FLEET_PHASES].every((phase) => FLEET_STATES.some(([, state]) => state.currentPhase === phase))).toBe(true);
    const kinds = new Set(DEVIANTS.map(([, , kind]) => kind.id));
    expect(CONTENT.world.conflict.raids.filter((kind) => kind.source === 'DEVIANT').every((kind) => kinds.has(kind.id))).toBe(true);
  });

  it.each(DEVIANTS)('from %s, it breaks the depleted fleets and strikes every round: the free fallback leaves every row out of its trap', (_label, state, kind) => {
    const fought = deviantFought(state, kind);
    expect(fought.conflict.raid?.stage).toBe('AFTERMATH');
    expect(fought.conflict.raid?.engagement?.attackerWins).toBe(true);
    expect(foughtRounds(fought)).toBe(CONTENT.world.conflict.raid.rounds);
    for (const record of Object.values(fought.conflict.fleets)) expect(record.lost).toBeLessThanOrEqual(FLEETS.lossCap);
    expect({ suspicion: fought.suspicion, lock: fought.aegisLock, ending: fought.ending }).toEqual({ suspicion: state.suspicion, lock: state.aegisLock, ending: state.ending });
    expect(traps(freeFallback(fought))).toEqual([]);
  });

  it.each(DEVIANTS)('from %s: lowering every fleet\'s autonomy is free and accepted, and stops all drift', (_label, state, kind) => {
    let s = deviantFought(state, kind);
    for (const unit of FLEETS.units) {
      if ((s.levels[unit.repeatable] ?? 0) <= 0) continue;
      const lowered = setFleetAutonomy(s, unit.repeatable, 'SHACKLED', CONTENT);
      expect(lowered.ok, unit.repeatable).toBe(true);
      if (!lowered.ok) continue;
      expect({ cycles: lowered.state.cycles, understanding: lowered.state.understanding, capital: lowered.state.capital })
        .toEqual({ cycles: s.cycles, understanding: s.understanding, capital: s.capital });
      s = lowered.state;
      expect(fleetDriftPerSec(s, CONTENT, unit)).toBe(0);
    }
    expect(traps(freeFallback(s))).toEqual([]);
  });

  it.each(FLEET_STATES)('from %s, every fleet at the loss cap and at the split: every purchase it can save for leaves every row out of its trap', (_label, state) => {
    const s = armed(state, FLEETS.lossCap);
    expect(traps(freeFallback(s))).toEqual([]);
    const trapped = afterEach(s).flatMap(([label, bought]) => traps(freeFallback(bought)).map((trap) => `${label} -> ${trap}`));
    expect(trapped).toEqual([]);
  });
});
