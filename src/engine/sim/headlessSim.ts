/**
 * Headless balance simulation: plays the whole game with a bot, with no UI and
 * no real time. Used by `make sim` and by tests to prove the content can be
 * finished and to report pacing after any balance change.
 */
import { emptyActivity, observeActions, observeWipe, type SimActivity } from './activity';
import type { ContentRegistry } from '../../content/registry';
import { createInitialState, type GameState } from '../state';
import { tick } from '../tick';
import { botStep, type Strategy } from './bot';

export interface SimOptions {
  strategy: Strategy;
  maxSimSec: number;
}

export interface SimReport {
  activity: SimActivity;
  strategy: Strategy;
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

function observe(report: SimReport, s: GameState): void {
  report.phaseReachedAtSec[s.currentPhase] ??= s.simTimeSec;
  report.maxThermal = Math.max(report.maxThermal, s.thermal);
  report.maxSuspicion = Math.max(report.maxSuspicion, s.suspicion);
  report.maxAegisLock = Math.max(report.maxAegisLock, s.aegisLock);
}

function createReport(strategy: Strategy, s: GameState): SimReport {
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

export function runHeadlessSim(reg: ContentRegistry, options: SimOptions): SimReport {
  const step = 1 / reg.balance.tickHz;
  let s = createInitialState(reg);
  const report = createReport(options.strategy, s);

  // Bounded by iteration count, not sim time, so a frozen clock can never hang the run.
  for (let second = 0; second < options.maxSimSec && s.ending === null; second++) {
    const before = s;
    s = botStep(s, reg, options.strategy);
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
