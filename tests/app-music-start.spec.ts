/**
 * When the soundtrack's fade-in starts (#198 item 1), the dip around each loop wrap (item 3)
 * and the output scale (item 4), through the controller: the fade waits for the player's
 * position to move, and the dip rides on top of whatever level the ramps hold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUCK_RAMP_MS, DUCK_RATIO, FADE_IN_MS } from '../src/app/musicController';
import { FADE_IN_WAIT_MS, SEAM_FLOOR, SEAM_GUARD_MS, SEAM_RISE_MS } from '../src/app/loopSeam';
import { OUTPUT_SCALE, SCORE_PEAK_CEILING, SPEECH_PEAK_CEILING } from '../src/app/outputLevel';
import { RAMP_STEP_MS } from '../src/app/volumeRamp';
import { fresh, harness, monotonic, run } from './music-ramp-harness';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

/** A player whose position stays put until `flow()` is called, as a file still loading does. */
function held(at = 0) {
  const state = { at, flowing: false };
  const playhead = () => ({ position: () => (state.flowing ? (state.at += RAMP_STEP_MS / 1000) : state.at), duration: () => 0 });
  return { playhead, flow: () => { state.flowing = true; }, hold: () => { state.flowing = false; } };
}

describe('the fade-in starts with the audio', () => {
  it('waits at silence while the file loads, then fades in over the whole of FADE_IN_MS', async () => {
    const loading = held();
    const h = await harness(40, true, loading.playhead);
    run(FADE_IN_MS + 200);
    expect(h.at(0).levels, 'nothing but the silent start while no audio flows').toEqual([0]);
    loading.flow();
    run(RAMP_STEP_MS);
    expect(h.at(0).levels[1], 'the first audible level is one step of the fade').toBeCloseTo(0.4 * OUTPUT_SCALE * RAMP_STEP_MS / FADE_IN_MS, 10);
    run(FADE_IN_MS);
    const fade = h.at(0).levels.slice(1);
    expect(fade.length).toBe(FADE_IN_MS / RAMP_STEP_MS);
    expect(monotonic(fade, true)).toBe(true);
    expect(fade.at(-1)).toBe(0.4 * OUTPUT_SCALE);
    h.stop();
  });

  it('waits on a return from the background until the position moves on from where it stopped', async () => {
    const player = held(37.2);
    const h = await harness(40, true, player.playhead);
    player.flow(); run(FADE_IN_MS);
    h.activity(false);
    player.hold();
    const levels = fresh(h.at(0));
    h.activity(true); run(FADE_IN_MS);
    expect(levels, 'set silent, then held there').toEqual([0]);
    player.flow(); run(FADE_IN_MS);
    expect(levels.length).toBe(1 + FADE_IN_MS / RAMP_STEP_MS);
    expect(levels.at(-1)).toBe(0.4 * OUTPUT_SCALE);
    h.stop();
  });

  it('keeps a duck that lands before the first sample a fade from silence, not a step', async () => {
    const loading = held();
    const h = await harness(40, true, loading.playhead);
    run(100);
    h.controller.setDucked(true); run(DUCK_RAMP_MS * 2);
    expect(h.at(0).levels).toEqual([0]);
    loading.flow(); run(DUCK_RAMP_MS);
    const levels = h.at(0).levels.slice(1);
    expect(levels.length).toBe(DUCK_RAMP_MS / RAMP_STEP_MS);
    expect(levels[0]).toBeLessThan(0.4 * OUTPUT_SCALE * DUCK_RATIO / 4);
    expect(levels.at(-1)).toBe(0.4 * OUTPUT_SCALE * DUCK_RATIO);
    h.stop();
  });

  it('stops waiting after FADE_IN_WAIT_MS for a player whose position never moves, and fades in anyway', async () => {
    const stuck = held(0);
    const h = await harness(40, true, stuck.playhead);
    run(FADE_IN_WAIT_MS - RAMP_STEP_MS);
    expect(h.at(0).levels).toEqual([0]);
    run(RAMP_STEP_MS);
    expect(h.at(0).levels.length, 'the first step lands on the last ask').toBe(2);
    run(FADE_IN_MS);
    expect(h.at(0).levels.length).toBe(1 + FADE_IN_MS / RAMP_STEP_MS);
    expect(h.at(0).levels.at(-1)).toBe(0.4 * OUTPUT_SCALE);
    h.stop();
  });

  it('fails a live player visibly when reading its position throws', async () => {
    const h = await harness(40, true, () => ({ position: () => { throw new Error('position failed'); }, duration: () => 0 }));
    expect(h.controller.state.getState()).toMatchObject({ playing: false, activated: false });
    expect(h.controller.state.getState().status).toContain('Playback unavailable');
    expect(h.at(0).log.at(-1)).toBe('pause');
    h.stop();
  });
});

describe('the dip around the loop wrap', () => {
  it('takes the level down to the floor before the end and back to it after, under a duck too', async () => {
    // A ten-second file entered eight seconds in; the position moves with the clock and wraps.
    const begun = Date.now();
    const h = await harness(40, true, () => ({ position: () => (8 + (Date.now() - begun) / 1000) % 10, duration: () => 10 }));
    run(FADE_IN_MS + 100);
    h.controller.setDucked(true); run(DUCK_RAMP_MS);
    const ducked = 0.4 * OUTPUT_SCALE * DUCK_RATIO;
    expect(h.at(0).levels.at(-1)).toBe(ducked);
    const levels = fresh(h.at(0));
    run(2000 - FADE_IN_MS - 100 - DUCK_RAMP_MS - SEAM_GUARD_MS + RAMP_STEP_MS);
    expect(levels.length, 'a few steps down, not one').toBeGreaterThanOrEqual(2);
    expect(monotonic(levels, false)).toBe(true);
    expect(levels.at(-1), 'at the floor before the wrap').toBeCloseTo(ducked * SEAM_FLOOR, 12);
    expect(levels[0], 'from the ducked level').toBeLessThan(ducked);
    fresh(h.at(0));
    run(SEAM_GUARD_MS + SEAM_RISE_MS + RAMP_STEP_MS * 2);
    expect(monotonic(levels, true)).toBe(true);
    expect(levels.at(-1), 'back to exactly the ducked level').toBe(ducked);
    h.stop();
  });
});

describe('headroom', () => {
  it('keeps the loudest score and the loudest clip under full scale together at 100% each, before the duck lands', () => {
    expect(OUTPUT_SCALE * (SCORE_PEAK_CEILING + SPEECH_PEAK_CEILING)).toBeLessThan(1);
    // And not by more than it needs: the scale is the largest round step that fits.
    expect((OUTPUT_SCALE + 0.05) * (SCORE_PEAK_CEILING + SPEECH_PEAK_CEILING)).toBeGreaterThan(1);
  });

  it('hands a player the preference times the output scale', async () => {
    const h = await harness(100); run(FADE_IN_MS);
    expect(h.at(0).levels.at(-1)).toBe(OUTPUT_SCALE);
    h.stop();
  });
});
