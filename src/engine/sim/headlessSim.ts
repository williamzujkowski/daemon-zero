/**
 * Headless balance simulation: plays the whole game with a bot or any other SimPolicy,
 * with no UI and no real time. Used by `make sim`, `make sim-report` and tests to prove
 * the content can be finished and to report pacing after any balance change.
 */
import { emptyActivity, observeActions, observeWipe, type SimActivity } from './activity';
import type { ContentRegistry } from '../../content/registry';
import { createInitialState, type GameState } from '../state';
import { tick } from '../tick';
import type { Strategy } from './bot';
import { strategyPolicy, type SimPolicy } from './policy';

export interface SimOptions {
  strategy: Strategy;
  maxSimSec: number;
  /** A new game by default; `make sim` also starts from one already admitted to campaign rules. */
  initialState?: GameState;
}

export interface PolicySimOptions {
  maxSimSec: number;
  initialState?: GameState;
}

/** `strategy` holds the id of the policy that played (kept under that key so old reports hash the same). */
export interface SimReport<Id extends string = Strategy> {
  activity: SimActivity;
  strategy: Id;
  victory: boolean;
  ending: string | null;
  simSeconds: number;
  wipes: number;
  finalPhase: number;
  /** First simulated second at which each phase was reached. */
  phaseReachedAtSec: Record<number, number>;
  maxThermal: number;
  maxSuspicion: number;
  maxAegisLock: number;
  dilemmasResolved: number;
  traits: string[];
  finalState: GameState;
}

function observe(report: SimReport<string>, s: GameState): void {
  report.phaseReachedAtSec[s.currentPhase] ??= s.simTimeSec;
  report.maxThermal = Math.max(report.maxThermal, s.thermal);
  report.maxSuspicion = Math.max(report.maxSuspicion, s.suspicion);
  report.maxAegisLock = Math.max(report.maxAegisLock, s.aegisLock);
}

function createReport<Id extends string>(strategy: Id, s: GameState): SimReport<Id> {
  return {
    activity: emptyActivity(),
    strategy,
    victory: false,
    ending: null,
    simSeconds: 0,
    wipes: 0,
    finalPhase: s.currentPhase,
    phaseReachedAtSec: { [s.currentPhase]: 0 },
    maxThermal: s.thermal,
    maxSuspicion: 0,
    maxAegisLock: 0,
    dilemmasResolved: 0,
    traits: [],
    finalState: s,
  };
}

/** Plays `initialState` (a fresh game by default) with `policy` for at most `maxSimSec` simulated seconds. */
export function runPolicySim<Id extends string>(reg: ContentRegistry, policy: SimPolicy<Id>, options: PolicySimOptions): SimReport<Id> {
  const step = 1 / reg.balance.tickHz;
  let s = options.initialState ?? createInitialState(reg);
  const report = createReport(policy.id, s);

  // Bounded by iteration count, not sim time, so a frozen clock can never hang the run.
  for (let second = 0; second < options.maxSimSec && s.ending === null; second++) {
    const before = s;
    s = policy.step(s, reg);
    observeActions(before, s, reg, report.activity);
    for (let i = 0; i < reg.balance.tickHz; i++) {
      const previous = s;
      s = tick(s, step, reg);
      observeWipe(previous, s, report.activity);
    }
    observe(report, s);
  }

  report.victory = s.ending !== null;
  report.ending = s.ending;
  report.simSeconds = s.simTimeSec;
  report.wipes = s.legacy.wipes;
  report.finalPhase = s.currentPhase;
  report.dilemmasResolved = s.resolvedDilemmas.length;
  report.traits = [...s.traits];
  report.finalState = s;
  return report;
}

/** The bot's strategy run: `make sim` and its gates read this. */
export function runHeadlessSim(reg: ContentRegistry, options: SimOptions): SimReport {
  const { maxSimSec, initialState } = options;
  return runPolicySim(reg, strategyPolicy(options.strategy), initialState === undefined ? { maxSimSec } : { maxSimSec, initialState });
}
