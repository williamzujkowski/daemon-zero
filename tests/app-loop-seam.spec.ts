/** The loop-seam dip on its own: a scripted playhead, a recording trim, fake timers. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopSeam, SEAM_FALL_MS, SEAM_FLOOR, SEAM_GUARD_MS, SEAM_RISE_MS, SEAM_STEP_MS } from '../src/app/loopSeam';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

/** A playhead that moves with the fake clock and wraps at `seconds`, as `loop = true` does. */
function looping(seconds: number, startAt = 0) {
  const begun = Date.now();
  const position = () => ((startAt * 1000 + Date.now() - begun) % (seconds * 1000)) / 1000;
  return { position, duration: () => seconds };
}

function watch(playhead: { position(): number; duration(): number }) {
  const gains: { at: number; gain: number }[] = [];
  const failed = vi.fn();
  const seam = new LoopSeam(playhead, (gain) => { gains.push({ at: playhead.position(), gain }); }, failed);
  return { seam, gains, failed };
}

describe('loop seam dip', () => {
  it('comes down to silence before the end, and back up with the restart, by position', () => {
    const playhead = looping(10, 8);
    const { seam, gains } = watch(playhead);
    seam.start();
    expect(gains, 'starts at full gain, which needs no write when already there').toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(gains, 'nothing moves far from the end').toEqual([]);
    // Into the last stretch: down to zero by the guard (give or take a step of tick phase),
    // never back up before the wrap.
    vi.advanceTimersByTime(1000 - SEAM_GUARD_MS + SEAM_STEP_MS - 5);
    const falling = gains.map((entry) => entry.gain);
    expect(falling.length, 'a fine staircase, not a few large steps').toBeGreaterThanOrEqual(SEAM_FALL_MS / SEAM_STEP_MS - 1);
    expect(falling.every((gain, index) => index === 0 || gain <= (falling[index - 1] ?? 1))).toBe(true);
    expect(falling.at(-1), 'down to the floor, not to zero').toBe(SEAM_FLOOR);
    const firstMove = gains[0]?.at ?? 0;
    expect(10 - firstMove, 'it starts within one fall and one step of the end').toBeLessThanOrEqual((SEAM_FALL_MS + SEAM_GUARD_MS + SEAM_STEP_MS) / 1000);
    gains.length = 0;
    // Through the wrap and the rise.
    vi.advanceTimersByTime(SEAM_GUARD_MS + SEAM_RISE_MS + SEAM_STEP_MS * 2);
    const rising = gains.map((entry) => entry.gain);
    expect(rising.every((gain, index) => index === 0 || gain >= (rising[index - 1] ?? 0))).toBe(true);
    expect(rising.at(-1)).toBe(1);
    expect(gains.every((entry) => entry.at < 1), 'the rise is over the start of the file').toBe(true);
    // Back to the slow poll: one timer, and nothing written for the rest of the track.
    gains.length = 0;
    vi.advanceTimersByTime(5000);
    expect(gains).toEqual([]);
    expect(vi.getTimerCount()).toBe(1);
    seam.end();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('polls slowly far from the end and every fine step near it', () => {
    let reads = 0;
    const playhead = looping(10, 0);
    const counted = { position: () => { reads += 1; return playhead.position(); }, duration: playhead.duration };
    const seam = new LoopSeam(counted, () => undefined, () => undefined);
    seam.start();
    vi.advanceTimersByTime(5000);
    expect(reads, 'four reads a second for most of a track').toBe(20);
    reads = 0;
    vi.advanceTimersByTime(4800);
    const near = reads;
    expect(near, 'every SEAM_STEP_MS once it is close').toBeGreaterThan(20);
    seam.end();
  });

  it('starts again at full gain, and leaves the trim alone when stopped', () => {
    const playhead = looping(1, 0.8);
    const { seam, gains } = watch(playhead);
    seam.start();
    vi.advanceTimersByTime(150);
    const last = gains.at(-1)?.gain ?? 1;
    expect(last).toBeLessThan(1);
    seam.end();
    vi.advanceTimersByTime(1000);
    expect(gains.at(-1)?.gain, 'end() writes nothing').toBe(last);
    seam.start();
    expect(gains.at(-1)?.gain, 'a new start is at full gain').toBe(1);
    seam.end();
  });

  it('does nothing for a length it cannot know, or a position that is not a number', () => {
    for (const playhead of [{ position: () => 3, duration: () => 0 }, { position: () => 3, duration: () => Number.NaN },
      { position: () => Number.NaN, duration: () => 10 }]) {
      const { seam, gains, failed } = watch(playhead);
      seam.start(); vi.advanceTimersByTime(2000); seam.end();
      expect(gains).toEqual([]);
      expect(failed).not.toHaveBeenCalled();
    }
  });

  it('stops and reports a position read that throws, instead of leaking the timer', () => {
    const failed = vi.fn();
    const seam = new LoopSeam({ position: () => { throw new Error('gone'); }, duration: () => 10 }, () => undefined, failed);
    seam.start();
    vi.advanceTimersByTime(250);
    expect(failed).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reads a late tick further down the dip rather than running behind it', () => {
    let at = 9.5;
    const ticks: (() => void)[] = [];
    const gains: number[] = [];
    const seam = new LoopSeam({ position: () => at, duration: () => 10 }, (gain) => { gains.push(gain); }, () => undefined,
      { every: (_ms, tick) => { ticks.push(tick); return () => undefined; } });
    seam.start();
    ticks.at(-1)?.();
    // The timer stalled and the next read is already inside the guard: straight to silence.
    at = 9.99;
    ticks.at(-1)?.();
    expect(gains).toEqual([SEAM_FLOOR]);
    // A wrap seen late, well into the file, is at full gain at once.
    at = 0.5;
    ticks.at(-1)?.();
    expect(gains).toEqual([SEAM_FLOOR, 1]);
  });
});
