/**
 * The simulation clock. `tick` advances one fixed step through the system
 * pipeline; `advance` converts elapsed wall-clock time into ticks. The engine
 * never reads a clock itself: callers pass elapsed time in, which keeps every
 * run deterministic and replayable.
 */
import type { ContentRegistry } from '../content/registry';
import { computeRates } from './rates';
import type { GameState } from './state';
import { evaluateDilemmas } from './systems/dilemmas';
import { integrateEscalation } from './systems/escalation';
import { integrateResources } from './systems/resources';
import { integrateAegis, integrateSuspicion, integrateThermal } from './systems/threats';
import type { TickSystem } from './systems/types';
import { fmt, pushLog } from './util';

/** Order matters. To add a mechanic, write a TickSystem and insert it here. */
export const TICK_PIPELINE: readonly TickSystem[] = [
  integrateResources,
  integrateThermal,
  integrateSuspicion,
  integrateEscalation,
  integrateAegis,
  evaluateDilemmas,
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

function advanceDormant(state: GameState, elapsedSec: number, reg: ContentRegistry): GameState {
  const b = reg.balance;
  const total = Math.min(elapsedSec, b.offlineCapSec);
  let s = state;
  for (let done = 0; done < total; done += b.offlineStepSec) {
    s = tick(s, Math.min(b.offlineStepSec, total - done), reg, true);
  }
  const d: GameState = { ...s, tickAccumulatorSec: 0 };
  const vars = { hours: (total / 3600).toFixed(1), percent: Math.round(b.offlineEfficiency * 100) };
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
