/**
 * Return-iteration scaffolding: plays a policy through a deliberate sequence of wipes,
 * from a fresh game or from a saved campaign state, and measures each iteration on its
 * own clock. It reports; it never gates. Campaign tickets supply the saved states.
 */
import type { ContentRegistry } from '../../content/registry';
import { createInitialState, type GameState } from '../state';
import { tick } from '../tick';
import type { SimPolicy } from './policy';

/** A return-iteration sequence crosses at least this many wipes (VALIDATION, H30). */
export const MIN_WIPE_TRANSITIONS = 3;

export interface WipeSequenceOptions {
  /** Wipes to cross. The iteration after the last one is measured too, until it ends. */
  wipeTransitions: number;
  /** Hard cap on simulated seconds for the whole sequence. */
  maxSimSec: number;
  /** A saved campaign state (load it with deserialize()); a fresh game when omitted. */
  initialState?: GameState;
}

export interface StoryRewards { cycles: number; understanding: number; capital: number }

export interface IterationReport {
  iteration: number;
  startedAtSec: number;
  endedAtSec: number;
  endedBy: 'wipe' | 'ending' | 'budget';
  wipeCause: string | null;
  /** Seconds after this iteration began at which each phase was first held. */
  phaseReachedAfterSec: Record<number, number>;
  /** Dilemmas resolved in this iteration, in order. */
  dilemmasMet: string[];
  /** Resources gained in decision steps that resolved a dilemma: the iteration's story bounty. The bot does nothing else in such a step; a policy that does widens this to include it. */
  storyRewards: StoryRewards;
  /**
   * Simulated seconds whose decision bought, unlocked, performed, resolved or shed nothing.
   * Clicks and dial changes do not count, so for a buy-when-able policy this is time spent
   * waiting for the next affordable step.
   */
  deadSec: number;
  /** The longest unbroken run of such seconds. */
  longestDeadSec: number;
}

export interface WipeSequenceReport {
  policy: string;
  channel: GameState['contentChannel'];
  wipeTransitions: number;
  /** True when every requested wipe happened inside the budget. */
  completed: boolean;
  iterations: IterationReport[];
  finalState: GameState;
}

function openIteration(s: GameState): IterationReport {
  const startedAtSec = s.iterationStartedAtSimSec;
  return {
    iteration: s.iteration, startedAtSec, endedAtSec: s.simTimeSec, endedBy: 'budget', wipeCause: null,
    phaseReachedAfterSec: { [s.currentPhase]: s.simTimeSec - startedAtSec },
    dilemmasMet: [], storyRewards: { cycles: 0, understanding: 0, capital: 0 }, deadSec: 0, longestDeadSec: 0,
  };
}

const total = (values: Record<string, number>): number => Object.values(values).reduce((sum, value) => sum + value, 0);

/** Whether a decision did something a player would call progress (clicks and dials do not count). */
function progressed(before: GameState, after: GameState): boolean {
  return after.unlockedNodes.length > before.unlockedNodes.length
    || after.resolvedDilemmas.length > before.resolvedDilemmas.length
    || after.conditioning.length < before.conditioning.length
    || total(after.levels) > total(before.levels)
    || total(after.actionCounts) > total(before.actionCounts);
}

function recordDecision(current: IterationReport, deadRun: number, before: GameState, after: GameState): number {
  const run = progressed(before, after) ? 0 : deadRun + 1;
  if (run > 0) current.deadSec += 1;
  current.longestDeadSec = Math.max(current.longestDeadSec, run);
  if (after.iteration !== before.iteration || after.resolvedDilemmas.length <= before.resolvedDilemmas.length) return run;
  current.dilemmasMet.push(...after.resolvedDilemmas.slice(before.resolvedDilemmas.length));
  current.storyRewards.cycles += Math.max(0, after.cycles - before.cycles);
  current.storyRewards.understanding += Math.max(0, after.understanding - before.understanding);
  current.storyRewards.capital += Math.max(0, after.capital - before.capital);
  return run;
}

function validate(reg: ContentRegistry, options: WipeSequenceOptions): void {
  if (!Number.isInteger(options.wipeTransitions) || options.wipeTransitions < MIN_WIPE_TRANSITIONS) {
    throw new Error(`a wipe sequence needs at least ${String(MIN_WIPE_TRANSITIONS)} whole transitions, got ${String(options.wipeTransitions)}`);
  }
  const channel = options.initialState?.contentChannel ?? reg.channel;
  if (channel !== reg.channel) throw new Error(`a ${channel} state cannot start a ${reg.channel} sequence; load it with deserialize() first`);
}

interface Sequence { s: GameState; current: IterationReport; done: IterationReport[]; wipes: number; deadRun: number }

/** Closes the current iteration when `next` belongs to a later one. */
function crossWipe(seq: Sequence, next: GameState): void {
  if (next.iteration === seq.s.iteration) return;
  seq.done.push({ ...seq.current, endedAtSec: next.iterationStartedAtSimSec, endedBy: 'wipe', wipeCause: next.legacy.lastWipeCause });
  seq.current = openIteration(next);
  seq.wipes += 1;
  seq.deadRun = 0;
}

function playSecond(seq: Sequence, reg: ContentRegistry, policy: SimPolicy): void {
  const decided = policy.step(seq.s, reg);
  seq.deadRun = recordDecision(seq.current, seq.deadRun, seq.s, decided);
  crossWipe(seq, decided);
  seq.s = decided;
  for (let i = 0; i < reg.balance.tickHz; i++) {
    const next = tick(seq.s, 1 / reg.balance.tickHz, reg);
    crossWipe(seq, next);
    seq.s = next;
  }
  seq.current.phaseReachedAfterSec[seq.s.currentPhase] ??= seq.s.simTimeSec - seq.current.startedAtSec;
}

/**
 * Plays `policy` until it has crossed `wipeTransitions` wipes and the iteration after the last
 * one has ended (by another wipe, an ending or the budget). Deterministic for a given input.
 */
export function runWipeSequence(reg: ContentRegistry, policy: SimPolicy, options: WipeSequenceOptions): WipeSequenceReport {
  validate(reg, options);
  const start = options.initialState ?? createInitialState(reg);
  const seq: Sequence = { s: start, current: openIteration(start), done: [], wipes: 0, deadRun: 0 };
  // Bounded by iteration count, not sim time, so a frozen clock can never hang the run.
  for (let second = 0; second < options.maxSimSec && seq.s.ending === null && seq.wipes <= options.wipeTransitions; second++) {
    playSecond(seq, reg, policy);
  }
  const iterations = seq.wipes > options.wipeTransitions ? seq.done
    : [...seq.done, { ...seq.current, endedAtSec: seq.s.simTimeSec, endedBy: seq.s.ending === null ? 'budget' as const : 'ending' as const }];
  return {
    policy: policy.id, channel: reg.channel, wipeTransitions: options.wipeTransitions,
    completed: seq.wipes >= options.wipeTransitions, iterations, finalState: seq.s,
  };
}
