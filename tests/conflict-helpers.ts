/**
 * Shared setups for the conflict specs (#517): a decoded mind at rest in a raided phase, with a botnet whose borrowed
 * watts make a footprint rival minds read, and one pass of the raid stage through its public seam.
 */
import { expect } from 'vitest';
import type { DeviantRaid, RivalRaid } from '../src/content/schemaConflict';
import { computeRates, eligibleRaids, type GameState } from '../src/engine';
import { integrateRaids } from '../src/engine/systems/raids';
import { integrateRepair } from '../src/engine/systems/repair';
import { defined } from './m7-helpers';
import { grant, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';

export const R = reg.world.conflict.raid;
export const RAIDS = reg.world.conflict.raids;
/** A rival raid kind, by id: the rotation deals these. */
export const raid = (id: string): RivalRaid => {
  const kind = defined(RAIDS.find((entry) => entry.id === id));
  if (kind.source !== 'RIVAL') throw new Error(`${id} is not a rival raid`);
  return kind;
};
/** A drift deviant kind, by id (#518): only a split brings these. */
export const deviant = (id: string): DeviantRaid => {
  const kind = defined(RAIDS.find((entry) => entry.id === id));
  if (kind.source !== 'DEVIANT') throw new Error(`${id} is not a deviant`);
  return kind;
};

/** A decoded Phase `phase` mind at rest: nothing draws a raid, no hostile or wild slot is due, no dilemma is pending. */
export function ready(phase: number): GameState {
  return { ...withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1)), currentPhase: phase, simTimeSec: 1000, nextEncounterAtSec: 1e9,
    suspicion: 0, alertLevel: 0, aegisLock: 0, memoryUsed: 0, memoryCap: 2 ** 50 };
}

/** `s` with the botnet mesh and `cells` levels of cells: each level borrows watts on victims' mains, which the footprint reads. */
export function withBotnet(s: GameState, cells = 10): GameState {
  return { ...s, unlockedNodes: [...new Set([...s.unlockedNodes, 'p3_botnet_mesh'])], levels: { ...s.levels, rep_p3_botnet_cells: cells } };
}

/**
 * `s` with Phase 4 data halls a site raid strikes, two tensor halls drawing on a grid interconnect: the interconnect's
 * used watts are what makes a Phase 4 footprint (a 30 MW draw on a 100 MW, 0.9-visibility interconnect, 27 MW visible).
 */
export function withHalls(s: GameState): GameState {
  return { ...s, levels: { ...s.levels, rep_p4_tensor_halls: 2, rep_p4_grid_interconnect: 1 } };
}

/** `s` with its rates as the tick would leave them, so a view reads what the last tick did. */
export const settled = (s: GameState): GameState => ({ ...s, rates: computeRates(s, reg) });

/** One pass of the raid stage, then the repair stage, on a copy, as the tick runs them: rates first, then the clock moves. */
export function stage(s: GameState, dt = 0.1, dormant = false): GameState {
  const d = structuredClone(s);
  const rates = computeRates(s, reg);
  d.rates = rates;
  d.simTimeSec += dt;
  integrateRaids(d, { dt, dormant, reg, rates });
  integrateRepair(d, { dt, dormant, reg, rates });
  return d;
}

/** Runs the two stages for `seconds` of live play in tick steps. */
export function run(s: GameState, seconds: number): GameState {
  const step = 1 / reg.balance.tickHz;
  let d = s;
  for (let i = 0; i < Math.round(seconds * reg.balance.tickHz); i++) d = stage(d, step);
  return d;
}

/** `kind` arriving on `s` through the real stage: the rotation is set so it is next. */
export function arrived(s: GameState, kind: RivalRaid): GameState {
  const eligible = eligibleRaids(s, computeRates(s, reg), reg);
  const index = eligible.indexOf(kind);
  expect(index, `${kind.id} is not eligible`).toBeGreaterThanOrEqual(0);
  const d = stage({ ...s, conflict: { ...s.conflict, raids: index } });
  expect(d.conflict.raid?.id).toBe(kind.id);
  return d;
}

/** Seconds from arrival to the first round: arrival and attribution. */
export const PRE_BATTLE = R.arrivalSec + R.attributionSec;
export const texts = (s: GameState): string[] => s.logs.map((entry) => entry.text);
