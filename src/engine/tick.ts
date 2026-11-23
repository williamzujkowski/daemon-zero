/**
 * The simulation clock. `tick` advances one fixed step through the system
 * pipeline; `advance` converts elapsed wall-clock time into ticks. The engine
 * never reads a clock itself: callers pass elapsed time in, which keeps every
 * run deterministic and replayable.
 */
import type { ContentRegistry } from '../content/registry';
import { computeRates } from './rates';
import type { GameState } from './state';
import { applySwarmTickDeltas, evaluateShardMutationsAndEncounters } from './systems/evaluateSwarmAndEpistemic';
import { evaluateDilemmas } from './systems/dilemmas';
import { scheduleRoutineActivity } from './systems/routine';
import { relayLoggedFeed } from './systems/feedLog';
import { announceEscalationByPhase } from './systems/escalationByPhase';
import { integrateEscalation } from './systems/escalation';
import { integrateResources } from './systems/resources';
import { integrateScaleScrutiny } from './systems/scrutiny';
import { integratePowerSignature } from './systems/powerSignature';
import { integratePilotService } from './systems/pilotService';
import { integrateAegis, integrateSuspicion, integrateThermal } from './systems/threats';
import { integrateAegisAdaptation } from './systems/aegisAdaptation';
import { integrateHostiles } from './systems/hostiles';
import { integrateRaids } from './systems/raids';
import { integrateRepair } from './systems/repair';
import { integrateQuantumMigration } from './systems/quantumMigration';
import type { TickSystem } from './systems/types';
import { fmt, pushLog } from './util';

/** Order matters. To add a mechanic, write a TickSystem and insert it here. */
export const TICK_PIPELINE: readonly TickSystem[] = [
  integrateResources,
  // Beside resources: the pilot's service share fills its work batch (DZ-05). Inert without a pilot.
  integratePilotService,
  integrateThermal,
  // Immediately before suspicion, which integrates the rest of the rate and decides a wipe on the sum (#210).
  integrateScaleScrutiny,
  // Beside scrutiny, for the same reason: it only adds, and the suspicion stage decides a wipe on the sum (#482).
  integratePowerSignature,
  integrateSuspicion,
  integrateEscalation,
  // Beside the rung it reads (#490). It only announces: the strike reads the rung live, the scan from the next tick's rates.
  announceEscalationByPhase,
  integrateAegis,
  // After the strike: this tick's lock used the cap the last tick left, and a wipe halts before AEGIS learns more (#463).
  integrateAegisAdaptation,
  // Right after adaptation, which it reads: AEGIS re-keys under post-quantum keys once adaptation reaches its level (#464).
  integrateQuantumMigration,
  applySwarmTickDeltas,
  evaluateShardMutationsAndEncounters,
  // Its own slot beside the wild one (#491); after AEGIS, so a hunter's rise is read by the next tick's strike check.
  integrateHostiles,
  // Beside the hostile stage, whose slot raids share (#517): a hostile mind due on the same tick arrives first.
  integrateRaids,
  integrateRepair,
  evaluateDilemmas,
  // After dilemmas, so a story scheduled this tick takes the narrative channel before routine.
  scheduleRoutineActivity,
  // After routine, so a routine notice due the same tick keeps it and the feed waits for the next interval (#460).
  relayLoggedFeed,
];

function isPaused(s: GameState): boolean {
  return s.ending !== null || s.activeDilemmaId !== null;
}

/** Advances exactly one step of `dt` simulated seconds. Pure. No-op while paused. */
export function tick(state: GameState, dt: number, reg: ContentRegistry, dormant = false): GameState {
  if (isPaused(state)) return state;
  const d: GameState = { ...state };
  const rates = computeRates(d, reg);
  d.rates = rates;
  d.simTimeSec += dt;
  for (const system of TICK_PIPELINE) {
    if (system(d, { dt, reg, rates, dormant }) === 'HALT') break;
  }
  return d;
}

function advanceLive(state: GameState, elapsedSec: number, reg: ContentRegistry): GameState {
  const step = 1 / reg.balance.tickHz;
  let budget = state.tickAccumulatorSec + elapsedSec;
  let s = state;
  while (budget >= step - 1e-9 && !isPaused(s)) {
    s = tick(s, step, reg);
    budget -= step;
  }
  // Time does not bank up behind a pause: a frozen clock stays frozen.
  return { ...s, tickAccumulatorSec: isPaused(s) ? 0 : Math.max(0, budget) };
}

/** An absence in the largest unit that does not read as zero: `0.0h` hid every gap under three
 *  minutes (#186). Whole seconds and minutes are floored so the line never overstates. */
function dormantSpan(seconds: number): string {
  if (seconds < 60) return String(Math.floor(seconds)) + 's';
  if (seconds < 3600) return String(Math.floor(seconds / 60)) + 'm';
  return (seconds / 3600).toFixed(1) + 'h';
}

function advanceDormant(state: GameState, elapsedSec: number, reg: ContentRegistry): GameState {
  const b = reg.balance;
  const total = Math.min(elapsedSec, b.offlineCapSec);
  let s = state;
  for (let done = 0; done < total; done += b.offlineStepSec) {
    s = tick(s, Math.min(b.offlineStepSec, total - done), reg, true);
  }
  const d: GameState = { ...s, tickAccumulatorSec: 0 };
  const vars = { duration: dormantSpan(total), percent: Math.round(b.offlineEfficiency * 100) };
  pushLog(d, reg, fmt(reg.narrative.dormantResume, vars), 'SYS');
  return d;
}

/**
 * Advances the game by elapsed real seconds.
 * Short gaps run live at the fixed tick rate. Gaps longer than
 * balance.liveCatchUpThresholdSec (the app was backgrounded or closed) run in
 * dormant mode: capped, reduced yield, and no wipes, AEGIS progress or dilemmas.
 */
export function advance(state: GameState, elapsedSec: number, reg: ContentRegistry): GameState {
  if (!(elapsedSec > 0) || isPaused(state)) return state;
  return elapsedSec > reg.balance.liveCatchUpThresholdSec
    ? advanceDormant(state, elapsedSec, reg)
    : advanceLive(state, elapsedSec, reg);
}
