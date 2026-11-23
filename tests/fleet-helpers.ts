/**
 * Shared setups for the fleet specs (#518): a decoded Phase 4 mind at rest with data halls a raid can strike and fleets
 * at chosen levels, and one pass of the conflict stages (raids, fleet drift, repair, fleet rebuild) through their public
 * seams, in the order TICK_PIPELINE runs them.
 */
import { computeRates, type FleetRecord, type GameState } from '../src/engine';
import { integrateFleetDrift } from '../src/engine/systems/fleetDrift';
import { integrateFleetRebuild } from '../src/engine/systems/fleetRebuild';
import { integrateRaids } from '../src/engine/systems/raids';
import { integrateRepair } from '../src/engine/systems/repair';
import { R, ready, withHalls } from './conflict-helpers';
import { reg } from './helpers';

export const F = reg.world.conflict.fleets;
export const DRONES = 'rep_p4_drone_fleet';
export const CREWS = 'rep_p4_humanoid_crews';
export const TENDERS = 'rep_p5_orbital_tenders';

/**
 * A decoded Phase 4 mind at rest with data halls, the mature fab every fleet needs, and its fleets at `levels`. The
 * rival rotation's interval is set far off, so only a split can bring a raid; `rivalRaidsDue` sets it due again.
 */
export function fleets(levels: Record<string, number>, phase = 4): GameState {
  const s = withHalls(ready(phase));
  return { ...s, unlockedNodes: [...new Set([...s.unlockedNodes, 'p4_mature_node_fab'])], levels: { ...s.levels, ...levels },
    conflict: { ...s.conflict, nextRaidAtSec: 1e9 } };
}

/** `s` with the rival rotation due, so a rival raid can arrive through the real stage. */
export const rivalRaidsDue = (s: GameState): GameState => ({ ...s, conflict: { ...s.conflict, nextRaidAtSec: 0 } });

/** `s` with one fleet's record set. */
export function withRecord(s: GameState, id: string, record: Partial<FleetRecord>): GameState {
  const old = s.conflict.fleets[id] ?? { autonomy: 'STANDARD' as const, drift: 0, lost: 0 };
  return { ...s, conflict: { ...s.conflict, fleets: { ...s.conflict.fleets, [id]: { ...old, ...record } } } };
}

/** One pass of the conflict stages on a copy, as the tick runs them: rates first, then the clock moves. */
export function fleetStage(s: GameState, dt = 0.1, dormant = false): GameState {
  const d = structuredClone(s);
  const rates = computeRates(s, reg);
  d.rates = rates;
  d.simTimeSec += dt;
  for (const system of [integrateRaids, integrateFleetDrift, integrateRepair, integrateFleetRebuild]) system(d, { dt, dormant, reg, rates });
  return d;
}

/** The conflict stages for `seconds` of live play in tick steps. */
export function fleetRun(s: GameState, seconds: number): GameState {
  const step = 1 / reg.balance.tickHz;
  let d = s;
  for (let i = 0; i < Math.round(seconds * reg.balance.tickHz); i++) d = fleetStage(d, step);
  return d;
}

/** Seconds from a raid's arrival to its first round (the engagement, for a fleet battle). */
export const TO_ENGAGEMENT = R.arrivalSec + R.attributionSec + R.roundSec;
