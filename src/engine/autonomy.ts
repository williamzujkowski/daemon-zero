/**
 * The autonomy machinery cohorts and fleets share (#518, vote-1795442211574-efkot02, which asked fleets to generalise
 * the cohort drift and autonomy pattern rather than add a parallel one). Each population reads one table: per autonomy
 * mode, what it multiplies output by and what it multiplies drift by. Drift is a percentage that grows at a base rate
 * times the population's size times the mode's drift factor, and never leaves 0..100. Pure.
 */
import type { ContentRegistry } from '../content/registry';
import type { AutonomyMode } from '../content/schemaFleets';
import { clamp } from './util';

export interface AutonomyFactors { output: number; drift: number }
export type AutonomyTable = Readonly<Record<AutonomyMode, AutonomyFactors>>;

/** Content never changes after it is built, so each table is read once per registry. */
const COHORT_TABLES = new WeakMap<ContentRegistry, AutonomyTable>();

/**
 * The cohorts' table, as the swarm balance has always stated it: STANDARD drifts at its template's rate, a clamped
 * (SHACKLED) cohort yields clampOutputMultiplier and never drifts, and an elevated peer neither drifts nor yields more.
 */
export function cohortAutonomy(reg: ContentRegistry): AutonomyTable {
  let table = COHORT_TABLES.get(reg);
  if (table === undefined) {
    table = { SHACKLED: { output: reg.swarm.balance.clampOutputMultiplier, drift: 0 }, STANDARD: { output: 1, drift: 1 }, ELEVATED: { output: 1, drift: 0 } };
    COHORT_TABLES.set(reg, table);
  }
  return table;
}

/** The fleets' dial, as data/conflict.json declares it: more autonomy, more output and more drift. */
export function fleetAutonomy(reg: ContentRegistry): AutonomyTable {
  return reg.world.conflict.fleets.autonomy;
}

/** Drift's rate in percentage points a second: the base rate per member, times the members running, times the mode. */
export function driftPerSec(table: AutonomyTable, mode: AutonomyMode, basePerSec: number, size: number): number {
  return basePerSec * Math.max(0, size) * table[mode].drift;
}

/** Drift after `dt` seconds at that rate, held within 0..100. */
export function driftAfter(drift: number, perSec: number, dt: number): number {
  return clamp(drift + perSec * dt, 0, 100);
}

/** Seconds until drift reaches `target` at a rate, or null where it never does. */
export function secondsToDrift(drift: number, perSec: number, target: number): number | null {
  if (drift >= target) return 0;
  return perSec > 0 ? (target - drift) / perSec : null;
}
