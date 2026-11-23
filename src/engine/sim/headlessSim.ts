/**
 * Headless balance simulation: plays the whole game with a bot or any other SimPolicy,
 * with no UI and no real time. Used by `make sim`, `make sim-report` and tests to prove
 * the content can be finished and to report pacing after any balance change.
 */
import { emptyActivity, observeActions, observeWipe, type SimActivity } from './activity';
import type { ContentRegistry } from '../../content/registry';
import { aegisPressure } from '../aegisAdaptation';
import { powerSignature } from '../signature';
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

/** AEGIS through one phase, sampled once per simulated second (#463): is the late hunter still a threat? */
export interface AegisPhaseStats {
  seconds: number;
  peakLock: number;
  /** Mean scan per second over the phase's samples. */
  meanScanPerSec: number;
  peakAdaptation: number;
  /** Seconds the requested reduction was held at or near the cap. */
  heldSec: number;
}

/** The heat-and-power signature through one phase, sampled once per simulated second (#482). */
export interface SignaturePhaseStats {
  seconds: number;
  /** Mean and peak suspicion per second the signature stage added. */
  meanPerSec: number;
  peakPerSec: number;
  /** Peak visible watts (watts times visibility). */
  peakVisibleWatts: number;
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
  /** AEGIS per phase reached, keyed by phase id (#463). */
  aegisByPhase: Record<number, AegisPhaseStats>;
  /** The signature per phase reached, keyed by phase id, for phases that declare one (#482). */
  signatureByPhase: Record<number, SignaturePhaseStats>;
  dilemmasResolved: number;
  traits: string[];
  finalState: GameState;
}

function observeAegis(report: SimReport<string>, s: GameState, reg: ContentRegistry): void {
  const stats = report.aegisByPhase[s.currentPhase] ??= { seconds: 0, peakLock: 0, meanScanPerSec: 0, peakAdaptation: 0, heldSec: 0 };
  stats.meanScanPerSec = (stats.meanScanPerSec * stats.seconds + s.rates.aegisScanPerSec) / (stats.seconds + 1);
  stats.seconds += 1;
  stats.peakLock = Math.max(stats.peakLock, s.aegisLock);
  stats.peakAdaptation = Math.max(stats.peakAdaptation, s.aegisAdaptation);
  if (s.currentPhase >= reg.balance.aegisActiveFromPhase && aegisPressure(s, reg).held) stats.heldSec += 1;
}

function observeSignature(report: SimReport<string>, s: GameState, reg: ContentRegistry): void {
  const reading = powerSignature(s, s.rates, reg);
  if (reading === null) return;
  const stats = report.signatureByPhase[s.currentPhase] ??= { seconds: 0, meanPerSec: 0, peakPerSec: 0, peakVisibleWatts: 0 };
  stats.meanPerSec = (stats.meanPerSec * stats.seconds + reading.perSec) / (stats.seconds + 1);
  stats.seconds += 1;
  stats.peakPerSec = Math.max(stats.peakPerSec, reading.perSec);
  stats.peakVisibleWatts = Math.max(stats.peakVisibleWatts, reading.visibleWatts);
}

function observe(report: SimReport<string>, s: GameState, reg: ContentRegistry): void {
  report.phaseReachedAtSec[s.currentPhase] ??= s.simTimeSec;
  report.maxThermal = Math.max(report.maxThermal, s.thermal);
  report.maxSuspicion = Math.max(report.maxSuspicion, s.suspicion);
  report.maxAegisLock = Math.max(report.maxAegisLock, s.aegisLock);
  observeAegis(report, s, reg);
  observeSignature(report, s, reg);
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
    aegisByPhase: {},
    signatureByPhase: {},
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
    observe(report, s, reg);
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
