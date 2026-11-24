/**
 * The reading observer (#540) is read-only: a run played through it is the run runHeadlessSim plays, to the byte, and
 * its change-only snapshot records what reading every second records. One shared observed run, on a short horizon.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runHeadlessSim, runPolicySim, type SimReport } from '../src/engine/sim/headlessSim';
import { STEALTH_POLICY } from '../src/engine/sim/policy';
import { observeReading, type ReadingRecord } from '../src/engine/sim/readingObserver';
import { ReadingRecorder } from '../src/engine/sim/readingRecorder';
import { fresh, reg } from './helpers';

/**
 * Thirty simulated minutes: the careful bot crosses into Phase 1 (5.9 min) and Phase 2 (17 min) and meets four
 * dilemmas, so the threshold, dilemma, log and card paths all run; the full run is what `make sim-reading` plays.
 */
const HORIZON_SEC = 1800;
const SLOW_MS = 30_000;
const sha = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function observe(everySecond: boolean): { report: SimReport; record: ReadingRecord } {
  const observer = observeReading(STEALTH_POLICY, reg, everySecond);
  const report = runPolicySim(reg, observer.policy, { maxSimSec: HORIZON_SEC });
  return { report, record: observer.finish(report.finalState) };
}
let shared: { report: SimReport; record: ReadingRecord } | undefined;
const observed = (): { report: SimReport; record: ReadingRecord } => shared ??= observe(false);

describe('the reading observer', () => {
  it('leaves the run identical to runHeadlessSim: sim seconds, phase-reached times and final hash', () => {
    const plain = runHeadlessSim(reg, { strategy: 'STEALTH', maxSimSec: HORIZON_SEC });
    const { report, record } = observed();
    expect(report.simSeconds).toBe(plain.simSeconds);
    expect(record.simSeconds).toBe(plain.simSeconds);
    expect(report.phaseReachedAtSec).toEqual(plain.phaseReachedAtSec);
    expect(record.phaseReachedAtSec).toEqual(plain.phaseReachedAtSec);
    expect(Object.keys(plain.phaseReachedAtSec).length).toBeGreaterThanOrEqual(3);
    expect(sha(report.finalState)).toBe(sha(plain.finalState));
    expect(sha(report)).toBe(sha(plain));
  }, SLOW_MS);

  it('records what a player reads, when, in which group and phase', () => {
    const { record } = observed();
    const boot = record.events.filter((e) => e.source === 'boot');
    expect(boot.length).toBeGreaterThan(0);
    expect(boot.every((e) => e.t === 0 && e.group === 'A')).toBe(true);
    expect(record.events.some((e) => e.source === 'threshold' && e.key === '0>1' && e.phase === 1)).toBe(true);
    expect(record.events.some((e) => e.source === 'node' && e.group === 'B')).toBe(true);
    expect(record.dilemmas.length).toBeGreaterThanOrEqual(2);
    const modals = record.events.filter((e) => e.source === 'dilemma');
    expect(modals.map((e) => [e.t, e.words])).toEqual(record.dilemmas.map((d) => [d.t, d.words]));
    expect(record.dilemmas.every((d) => d.words > 0)).toBe(true);
    // Only the log repeats; every other surface counts a text once.
    expect(record.events.filter((e) => e.repeat).every((e) => e.source === 'log')).toBe(true);
    expect(record.decisions.length).toBeGreaterThan(0);
    const spent = Object.values(record.phaseSec).reduce((a, b) => a + b, 0);
    expect(spent).toBeCloseTo(record.simSeconds, 6);
    expect(record.snapshots).toBeLessThan(record.seconds / 2);
  }, SLOW_MS);

  it('snapshots only on change and still records exactly what reading every second records', () => {
    const everySecond = observe(true).record;
    const { record } = observed();
    expect(everySecond.snapshots).toBe(everySecond.seconds + 1);
    expect(record.events).toEqual(everySecond.events);
    expect(record.dilemmas).toEqual(everySecond.dilemmas);
    expect(record.decisions).toEqual(everySecond.decisions);
    expect(record.phaseSec).toEqual(everySecond.phaseSec);
  }, SLOW_MS);

  it('records a game that never stepped, and the ending once one is chosen', () => {
    const start = fresh();
    const record = observeReading(STEALTH_POLICY, reg).finish(start);
    expect(record.phaseReachedAtSec).toEqual({ [start.currentPhase]: 0 });
    expect(record.events.filter((e) => e.source === 'boot').length).toBe(start.logs.length);
    expect(record.ending).toBeNull();

    const ending = reg.endings[0];
    if (!ending) throw new Error('content has no ending');
    const recorder = new ReadingRecorder(reg);
    recorder.ending({ ...start, ending: ending.id });
    expect(recorder.events).toEqual([expect.objectContaining({ source: 'ending', group: 'A', key: ending.id })]);
    expect(recorder.events[0]?.words).toBeGreaterThan(0);
    recorder.ending(start);
    expect(recorder.events).toHaveLength(1);
  });
});
