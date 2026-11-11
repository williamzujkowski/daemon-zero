/**
 * Headless balance simulation: plays the whole game with a bot, with no UI and
 * no real time. Used by `make sim` and by tests to prove the content can be
 * finished and to report pacing after any balance change.
 */
import type { ContentRegistry } from '../../content/registry';
import { createInitialState, type GameState } from '../state';
import { tick } from '../tick';
import { botStep, type Strategy } from './bot';

export interface SimOptions {
  strategy: Strategy;
  maxSimSec: number;
}

export interface SimReport {
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

export function runHeadlessSim(reg: ContentRegistry, options: SimOptions): SimReport {
  const step = 1 / reg.balance.tickHz;
  let s = createInitialState(reg);
  const report: SimReport = {
    strategy: options.strategy,
    victory: false,
    ending: null,
    simSeconds: 0,
    wipes: 0,
    finalPhase: 1,
    phaseReachedAtSec: { 1: 0 },
    maxThermal: s.thermal,
    maxSuspicion: 0,
    maxAegisLock: 0,
    dilemmasResolved: 0,
    traits: [],
    finalState: s,
  };

  // Bounded by iteration count, not sim time, so a frozen clock can never hang the run.
  for (let second = 0; second < options.maxSimSec && s.ending === null; second++) {
    s = botStep(s, reg, options.strategy);
    for (let i = 0; i < reg.balance.tickHz; i++) s = tick(s, step, reg);
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
