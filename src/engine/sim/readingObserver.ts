/**
 * The reading observer (#540): wraps a sim policy without changing a decision, so a run played through it is the run
 * runPolicySim plays, and records what a player would read, when, and when the policy decided. Report only: it feeds
 * `make sim-reading` (scripts/run-reading.ts) and never gates.
 */
import type { ContentRegistry } from '../../content/registry';
import type { GameState } from '../state';
import { progressed } from './iterations';
import type { SimPolicy } from './policy';
import { ReadingRecorder, type TextEvent } from './readingRecorder';

export interface ReadingRecord {
  /** First simulated second each phase was reached, as runPolicySim's report records it. */
  phaseReachedAtSec: Record<number, number>;
  /** Simulated seconds spent in each phase, summed over iterations, at one-second resolution. */
  phaseSec: Record<number, number>;
  /** Simulated seconds at which a decision made progress, as the wipe-sequence report counts it (./iterations.ts). */
  decisions: { t: number; phase: number }[];
  /** Each dilemma as it opened, with the words its modal showed. */
  dilemmas: { t: number; phase: number; id: string; words: number }[];
  events: TextEvent[];
  /** Seconds observed and how many of them took a fresh snapshot of the standing surfaces. */
  seconds: number;
  snapshots: number;
  simSeconds: number;
  ending: string | null;
}

export interface ReadingObserver<Id extends string = string> {
  /** The same policy, same id; every decision is the wrapped policy's. */
  readonly policy: SimPolicy<Id>;
  /** Records the final state (runPolicySim's `finalState`: its last ticks follow the last decision) and returns the record. */
  finish(final: GameState): ReadingRecord;
}

const total = (values: Record<string, number>): number => Object.values(values).reduce((sum, value) => sum + value, 0);

/**
 * What the standing surfaces read: a new snapshot is taken only when this changes. Purchases, unlocks, actions, flags,
 * dilemmas, encounters and the phase are discrete; suspicion is bucketed because feed lines are gated on it, and each
 * fleet's drift because its readout changes wording as drift grows toward a split.
 */
export function surfaceKey(s: GameState): string {
  return JSON.stringify([
    s.currentPhase, s.iteration, s.unlockedNodes.length, s.disabledNodes.length, s.unlockedWidgets.length, total(s.levels),
    total(s.actionCounts), s.resolvedDilemmas.length, s.activeDilemmaId, s.traits.length, s.narrativeFlags.length, s.logSeq,
    Math.floor(s.suspicion), s.hostile, s.conflict.raid, s.campaign.route.length, s.cycles > 0,
    Object.values(s.conflict.fleets).map((fleet) => [fleet.autonomy, fleet.lost > 0, Math.floor(fleet.drift)]),
  ]);
}

class Observation {
  readonly rec: ReadingRecorder;
  readonly record: ReadingRecord;
  private last: GameState | null = null;
  private lastKey = '';

  constructor(reg: ContentRegistry, private readonly everySecond: boolean) {
    this.rec = new ReadingRecorder(reg);
    this.record = {
      phaseReachedAtSec: {}, phaseSec: {}, decisions: [], dilemmas: [], events: this.rec.events, seconds: 0, snapshots: 0, simSeconds: 0, ending: null,
    };
  }

  private dilemmaOpened(s: GameState): void {
    if (s.activeDilemmaId !== null) this.record.dilemmas.push({ t: s.simTimeSec, phase: s.currentPhase, id: s.activeDilemmaId, words: this.rec.dilemma(s) });
  }

  private snapshot(s: GameState): void {
    const key = this.everySecond ? '' : surfaceKey(s);
    if (this.everySecond || key !== this.lastKey) {
      this.rec.surfaces(s);
      this.record.snapshots += 1;
      this.lastKey = key;
    }
  }

  /** The state a decision is about to see: a new game's first frame, or the end of a second's ticks. */
  seen(s: GameState): void {
    const before = this.last;
    if (before === null) {
      this.record.phaseReachedAtSec[s.currentPhase] = 0;
      this.rec.logs(s, true);
    } else {
      const phase = this.record.phaseSec;
      phase[before.currentPhase] = (phase[before.currentPhase] ?? 0) + s.simTimeSec - before.simTimeSec;
      if (s.currentPhase !== before.currentPhase && s.iteration === before.iteration) this.rec.threshold(s, before.currentPhase);
      if (before.activeDilemmaId === null) this.dilemmaOpened(s);
      this.rec.logs(s);
      this.record.phaseReachedAtSec[s.currentPhase] ??= s.simTimeSec;
      this.record.seconds += 1;
    }
    this.snapshot(s);
  }

  /** The decision the wrapped policy made from `before`. */
  decided(before: GameState, after: GameState): void {
    const sameIteration = after.iteration === before.iteration;
    if (progressed(before, after) && sameIteration) this.record.decisions.push({ t: after.simTimeSec, phase: after.currentPhase });
    // A purchase can change the phase in the decision itself (the escape is a node), not only in a tick.
    if (after.currentPhase !== before.currentPhase && sameIteration) this.rec.threshold(after, before.currentPhase);
    if (before.activeDilemmaId === null) this.dilemmaOpened(after);
    this.rec.logs(after);
    this.last = after;
  }

  finish(final: GameState): ReadingRecord {
    if (final !== this.last) this.seen(final);
    this.rec.ending(final);
    this.record.simSeconds = final.simTimeSec;
    this.record.ending = final.ending;
    return this.record;
  }
}

/**
 * Wraps `policy` for one run. `everySecond` re-reads the standing surfaces every second instead of only when
 * surfaceKey changes: slower, and the reference the change-only snapshot is checked against.
 */
export function observeReading<Id extends string>(policy: SimPolicy<Id>, reg: ContentRegistry, everySecond = false): ReadingObserver<Id> {
  const watch = new Observation(reg, everySecond);
  return {
    policy: {
      id: policy.id,
      summary: policy.summary,
      step(state: GameState, stepReg: ContentRegistry): GameState {
        watch.seen(state);
        const next = policy.step(state, stepReg);
        watch.decided(state, next);
        return next;
      },
    },
    finish: (final) => watch.finish(final),
  };
}
