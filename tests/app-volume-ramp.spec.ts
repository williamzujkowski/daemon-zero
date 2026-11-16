/** The ramp scheduler on its own: fake timers, a recording writer, no controller. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemClock } from '../src/app/clock';
import { RAMP_STEP_MS, VolumeRamp } from '../src/app/volumeRamp';
import { monotonic } from './music-ramp-harness';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function recording(start = 0) {
  const levels: number[] = [];
  const ramp = new VolumeRamp((level) => { levels.push(level); });
  ramp.set(start);
  levels.length = 0;
  return { ramp, levels };
}

describe('volume ramp', () => {
  it.each([[0, 0.3, 500], [0.3, 0.105, 200], [0.105, 0.3, 200], [0.4, 0, 500], [0, 1, 190]])(
    'steps from %d to %d over %d ms monotonically and lands exactly on the target', (from, to, durationMs) => {
      const { ramp, levels } = recording(from);
      const done = vi.fn();
      ramp.to(to, durationMs, done);
      expect(levels, 'nothing is written before the first step').toEqual([]);
      vi.advanceTimersByTime(durationMs - RAMP_STEP_MS);
      expect(done).not.toHaveBeenCalled();
      expect(vi.getTimerCount(), 'still in flight').toBe(1);
      vi.advanceTimersByTime(RAMP_STEP_MS * 2);
      expect(levels.length).toBe(Math.ceil(durationMs / RAMP_STEP_MS));
      expect(monotonic(levels, to > from)).toBe(true);
      // Strictly between the ends on the way: a ramp that jumped would have no such level.
      expect(levels.slice(0, -1).every((level) => level > Math.min(from, to) && level < Math.max(from, to))).toBe(true);
      expect(levels.at(-1)).toBe(to);
      expect(ramp.current).toBe(to);
      expect(done).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    });

  it('starts a new target from the current level, not from the old target', () => {
    const { ramp, levels } = recording(0);
    const first = vi.fn();
    ramp.to(1, 200, first);
    vi.advanceTimersByTime(100);
    expect(ramp.current).toBe(0.5);
    levels.length = 0;
    ramp.to(0, 100);
    vi.advanceTimersByTime(100);
    expect(levels).toEqual([0.375, 0.25, 0.125, 0]);
    expect(first, 'an interrupted ramp never reports completion').not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels where it is and writes nothing afterwards', () => {
    const { ramp, levels } = recording(0);
    const done = vi.fn();
    ramp.to(1, 200, done);
    vi.advanceTimersByTime(50);
    ramp.cancel();
    const written = [...levels];
    vi.advanceTimersByTime(1000);
    expect(levels).toEqual(written);
    expect(ramp.current).toBe(0.25);
    expect(done).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never writes again once closed, by ramp, by set or by retarget', () => {
    const { ramp, levels } = recording(0.4);
    ramp.to(0, 200);
    vi.advanceTimersByTime(50);
    ramp.close();
    const written = [...levels];
    const done = vi.fn();
    ramp.set(1); ramp.retarget(0.5); ramp.to(0.2, 100, done); ramp.to(0.3, 0, done);
    vi.advanceTimersByTime(1000);
    expect(levels).toEqual(written);
    expect(done).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sets a level at once, abandoning a ramp in flight', () => {
    const { ramp, levels } = recording(0);
    ramp.to(1, 200);
    vi.advanceTimersByTime(50);
    levels.length = 0;
    ramp.set(0.6);
    vi.advanceTimersByTime(1000);
    expect(levels).toEqual([0.6]);
  });

  it('bends a ramp in flight to a new target on its original deadline, and moves a level at rest at once', () => {
    const { ramp, levels } = recording(0);
    ramp.retarget(0.2);
    expect(levels).toEqual([0.2]);
    expect(vi.getTimerCount()).toBe(0);
    ramp.set(0);
    const done = vi.fn();
    ramp.to(1, 200, done);
    vi.advanceTimersByTime(100);
    expect(ramp.current).toBe(0.5);
    levels.length = 0;
    ramp.retarget(0);
    expect(levels, 'bending writes nothing by itself').toEqual([]);
    vi.advanceTimersByTime(75);
    expect(vi.getTimerCount(), 'still in flight').toBe(1);
    vi.advanceTimersByTime(25);
    expect(levels, 'the four steps it had left, from where it was').toEqual([0.375, 0.25, 0.125, 0]);
    expect(done, 'the completion survives the bend').toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps moving while it is retargeted faster than one step, as a held control does', () => {
    const { ramp, levels } = recording(0);
    ramp.to(0.3, 500);
    // A new level every 10 ms for the whole fade: a ramp restarted each time never ticks.
    for (let elapsed = 10; elapsed < 500; elapsed += 10) {
      vi.advanceTimersByTime(10);
      ramp.retarget(0.3 + elapsed / 1000);
    }
    vi.advanceTimersByTime(10);
    expect(levels.length, 'one write per step throughout').toBe(20);
    expect(monotonic(levels, true)).toBe(true);
    expect(levels[3], 'already well off the floor after 100 ms').toBeGreaterThan(0.03);
    expect(ramp.current).toBe(0.3 + 490 / 1000);
    expect(vi.getTimerCount(), 'and done on its original deadline').toBe(0);
  });

  it('takes its timer from the app clock and gives it back', () => {
    const every = vi.spyOn(systemClock, 'every');
    const cancel = vi.spyOn(systemClock, 'cancel');
    const { ramp } = recording(0);
    ramp.to(1, 100);
    expect(every).toHaveBeenCalledOnce();
    expect(every.mock.calls[0]?.[1]).toBe(RAMP_STEP_MS);
    ramp.cancel();
    expect(cancel).toHaveBeenCalledWith(every.mock.results[0]?.value);
    every.mockRestore(); cancel.mockRestore();
  });

  it('schedules nothing for a zero duration or an unchanged level, and still reports completion', () => {
    const { ramp, levels } = recording(0.3);
    const done = vi.fn();
    ramp.to(0.3, 500, done);
    ramp.to(0.1, 0, done);
    ramp.to(0.2, RAMP_STEP_MS, done);
    expect(levels).toEqual([0.3, 0.1, 0.2]);
    expect(done).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops and reports a write that throws mid-ramp instead of leaking the timer', () => {
    const failed = vi.fn();
    const done = vi.fn();
    let calls = 0;
    const ramp = new VolumeRamp(() => { calls += 1; if (calls === 3) throw new Error('player gone'); }, failed);
    ramp.set(0);
    ramp.to(1, 200, done);
    vi.advanceTimersByTime(1000);
    expect(failed).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
    expect(calls).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clips a ramp to a limit without moving its steps, its deadline or its completion', () => {
    const { ramp, levels } = recording(1);
    const done = vi.fn();
    ramp.to(0, 200, done);
    vi.advanceTimersByTime(50);
    expect(levels).toEqual([0.875, 0.75]);
    ramp.limit(0.25);
    expect(levels.at(-1), 'down to the limit at once').toBe(0.25);
    expect(ramp.current).toBe(0.25);
    vi.advanceTimersByTime(125);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(25);
    expect(done).toHaveBeenCalledOnce();
    expect(levels.slice(2)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25, 0.125, 0]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('only ever tightens a limit, writes nothing for one above the level, and none once closed', () => {
    const { ramp, levels } = recording(0.4);
    ramp.to(0, 200);
    vi.advanceTimersByTime(50);
    levels.length = 0;
    ramp.limit(0.9);
    expect(levels, 'a limit above the level moves nothing').toEqual([]);
    ramp.limit(0.1); ramp.limit(0.9);
    vi.advanceTimersByTime(25);
    expect(levels, 'loosening it again lifts nothing').toEqual([0.1, 0.1]);
    ramp.close(); ramp.limit(0);
    expect(levels).toEqual([0.1, 0.1]);
  });

  it('runs on a supplied clock and step', () => {
    const ticks: Array<() => void> = [];
    const stop = vi.fn();
    const levels: number[] = [];
    const ramp = new VolumeRamp((level) => { levels.push(level); }, undefined, { every: (_ms, tick) => { ticks.push(tick); return stop; } }, 50);
    ramp.to(1, 100);
    ticks[0]?.(); ticks[0]?.();
    expect(levels).toEqual([0.5, 1]);
    expect(stop).toHaveBeenCalledOnce();
  });
});
