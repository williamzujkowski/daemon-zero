/**
 * What may happen to a fade-out in flight (#88, panel round 1 on PR #183). A fading player has
 * left the controller's live slot, so every control has to be asked on purpose whether it
 * still reaches it: a level of zero must, a lower level must, and nothing may ever turn it up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DUCK_RAMP_MS, FADE_IN_MS, FADE_OUT_MS } from '../src/app/musicController';
import { RAMP_STEP_MS } from '../src/app/volumeRamp';
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { fresh, harness, monotonic, run, settle } from './music-ramp-harness';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

/** An audible player a fifth of the way through the fade-out that follows the ending. */
async function fading() {
  const h = await harness(); run(FADE_IN_MS);
  h.end(); run(FADE_OUT_MS / 5);
  expect(h.at(0).levels.at(-1)).toBeCloseTo(0.32, 10);
  expect(h.at(0).removed).toBe(false);
  return h;
}
/** The fade-out still ends on its original deadline: not a step early, not a step late.
 *  `spentMs` is what the case has already run since `fading()` handed the player over. */
function expectOriginalDeadline(h: Awaited<ReturnType<typeof harness>>, spentMs = 0) {
  run(FADE_OUT_MS * 4 / 5 - spentMs - RAMP_STEP_MS);
  expect(h.at(0).removed).toBe(false);
  run(RAMP_STEP_MS);
  expect(h.at(0).levels.at(-1)).toBe(0);
  expect(h.at(0).log.slice(-3)).toEqual(['volume', 'pause', 'remove']);
  expect(vi.getTimerCount()).toBe(0);
}

describe('a fade-out in flight', () => {
  it('is silenced and released at once by volume zero, after the ending and after music is switched off', async () => {
    const ended = await fading();
    ended.controller.setVolume(0); await settle();
    expect(ended.at(0).removed, 'volume 0 is immediate for the outgoing player too').toBe(true);
    expect(ended.at(0).log.slice(-2)).toEqual(['pause', 'remove']);
    expect(vi.getTimerCount()).toBe(0);
    expect(JSON.parse(ended.storage.getItem(AUDIO_KEY) ?? '')).toMatchObject({ volume: 0 });
    run(5000);
    expect(ended.violations).toEqual([]);
    ended.stop();

    const off = await harness(); run(FADE_IN_MS);
    off.controller.toggle(); run(FADE_OUT_MS / 5);
    off.controller.setVolume(0);
    expect(off.at(0).removed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    off.stop();
  });

  it('comes straight down to a lower level, never goes up for a higher one, and keeps its deadline', async () => {
    const h = await fading();
    const levels = fresh(h.at(0));
    h.controller.setVolume(10);
    expect(levels, 'not left louder than the preference just chosen').toEqual([0.1]);
    h.controller.setVolume(90);
    expect(levels, 'a higher level writes nothing to a player on its way out').toEqual([0.1]);
    run(RAMP_STEP_MS * 3);
    // Raising it again must not lift the cap the lower level set.
    expect(Math.max(...levels)).toBe(0.1);
    expect(monotonic(levels, false)).toBe(true);
    expectOriginalDeadline(h, RAMP_STEP_MS * 3);
    expect(monotonic(levels, false)).toBe(true);
    expect(h.players.length, 'the ending creates nothing').toBe(1);
    expect(h.violations).toEqual([]);
    h.stop();

    const raised = await fading();
    const untouched = fresh(raised.at(0));
    raised.controller.setVolume(100); run(FADE_OUT_MS);
    expect(Math.max(...untouched), 'only ever downwards from where it was').toBeLessThan(0.32);
    expect(monotonic(untouched, false)).toBe(true);
    raised.stop();
  });

  it('is capped by the preference and not by the duck when the volume changes while a clip talks', async () => {
    const h = await fading();
    const levels = fresh(h.at(0));
    h.controller.setDucked(true);
    // 50% is above where it is; 50% ducked (0.175) is below. Only the first is the cap.
    h.controller.setVolume(50);
    expect(levels, 'the duck is not smuggled in through the volume control').toEqual([]);
    h.controller.setVolume(20);
    expect(levels, 'clipped to the preference itself').toEqual([0.2]);
    expectOriginalDeadline(h);
    expect(monotonic(levels, false)).toBe(true);
    h.stop();
  });

  it('carries on to silence when music is switched off during it, and creates nothing', async () => {
    const h = await fading();
    const levels = fresh(h.at(0));
    h.controller.toggle(); await settle();
    expect(h.controller.state.getState()).toMatchObject({ enabled: false, playing: false });
    expect(h.at(0).removed, 'switching off is itself a fade-out: the one in flight is it').toBe(false);
    run(RAMP_STEP_MS * 3);
    expectOriginalDeadline(h, RAMP_STEP_MS * 3);
    expect(monotonic(levels, false)).toBe(true);
    expect(h.players.length).toBe(1);
    h.stop();
  });

  it('is not bent by a duck or its release: no step, no rise, same deadline', async () => {
    const plain = await fading();
    const expected = fresh(plain.at(0));
    run(FADE_OUT_MS);
    plain.stop();

    const h = await fading();
    const levels = fresh(h.at(0));
    h.controller.setDucked(true); run(DUCK_RAMP_MS / 2);
    h.controller.setDucked(false); run(RAMP_STEP_MS);
    h.controller.setDucked(true);
    expectOriginalDeadline(h, DUCK_RAMP_MS / 2 + RAMP_STEP_MS);
    expect(levels).toEqual(expected);
    h.stop();
  });

  it('reports the setting, not the tail: nothing is playing once the fade-out starts', async () => {
    const ended = await harness(); run(FADE_IN_MS);
    ended.at(0).status(true, false);
    expect(ended.controller.state.getState().playing).toBe(true);
    ended.end();
    expect(ended.at(0).removed).toBe(false);
    expect(ended.controller.state.getState()).toMatchObject({ trackPhase: null, playing: false });
    // The fading player has no voice: neither a status nor an error of its own can change that.
    ended.at(0).status(true, false); ended.at(0).status(false, true);
    expect(ended.controller.state.getState()).toMatchObject({ playing: false, activated: true, status: '' });
    ended.stop();

    const off = await harness(); run(FADE_IN_MS);
    off.at(0).status(true, false);
    off.controller.toggle();
    expect(off.at(0).removed).toBe(false);
    expect(off.controller.state.getState()).toMatchObject({ enabled: false, activated: false, playing: false });
    off.at(0).status(true, false);
    expect(off.controller.state.getState().playing).toBe(false);
    off.stop();
  });
});

describe('starting a player is never left to a timer', () => {
  it('swaps the score for a phase change inside the call that changed the phase, then fades in', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.phase(1);
    // All of this before any timer has run: `play()` is in the call stack of the press.
    expect(h.at(0).log.slice(-2)).toEqual(['pause', 'remove']);
    expect(h.players.length).toBe(2);
    expect(h.at(1).phase).toBe(1);
    expect(h.at(1).log).toEqual(['volume', 'play']);
    expect(h.at(1).levels).toEqual([0]);
    expect(h.live(), 'one player at a time').toBe(1);
    run(FADE_IN_MS);
    expect(monotonic(h.at(1).levels, true)).toBe(true);
    expect(h.at(1).levels.at(-1)).toBe(0.4);
    expect(vi.getTimerCount()).toBe(0);
    h.stop();
  });

  it('restarts for a wipe or an import at once', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.game.initialize(h.game.store.getState().game, 0, null);
    expect(h.at(0).removed).toBe(true);
    expect(h.at(1).log).toEqual(['volume', 'play']);
    h.game.dispatch((state) => ({ ok: true, state: { ...state, iteration: state.iteration + 1 } }));
    expect(h.at(2).log).toEqual(['volume', 'play']);
    expect(h.live()).toBe(1);
    h.stop();
  });

  it('cuts a fade-out short when music is wanted again, so the new player starts in that call', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.controller.toggle(); run(FADE_OUT_MS / 2);
    expect(h.at(0).removed).toBe(false);
    h.controller.toggle();
    expect(h.at(0).removed, 'the old player goes before the new one exists').toBe(true);
    expect(h.players.length).toBe(2);
    expect(h.at(1).log).toEqual(['volume', 'play']);
    expect(h.live()).toBe(1);

    // The same for a new run arriving while the ending is still fading out.
    run(FADE_IN_MS); h.end(); run(FADE_OUT_MS / 2);
    expect(h.at(1).removed).toBe(false);
    h.game.dispatch((state) => ({ ok: true, state: { ...state, ending: null, iteration: state.iteration + 1 } }));
    expect(h.at(1).removed).toBe(true);
    expect(h.at(2).log).toEqual(['volume', 'play']);
    expect(h.live()).toBe(1);
    expect(h.violations).toEqual([]);
    h.stop();
  });
});

describe('a fading player that throws while being released', () => {
  it('is removed and forgotten without an uncaught error from the timer, and is not reported as a playback failure', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.controller.toggle(); run(FADE_OUT_MS - RAMP_STEP_MS);
    h.at(0).throws = 'pause';
    expect(() => { run(RAMP_STEP_MS); }, 'nothing can catch a throw from a timer tick').not.toThrow();
    expect(h.at(0).removed, 'a throwing pause must not skip the remove').toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    // Music was switched off: "playback unavailable, try Resume" would be advice for nothing.
    expect(h.controller.state.getState()).toMatchObject({ enabled: false, playing: false, status: '' });
    h.controller.toggle(); await settle();
    expect(h.players.length).toBe(2);
    expect(h.at(1).log).toEqual(['volume', 'play']);
    expect(h.live()).toBe(1);
    h.stop();
  });

  it('does not stop the start, the volume change or the backgrounding that released it', async () => {
    for (const act of [
      (h: Awaited<ReturnType<typeof harness>>) => { h.controller.toggle(); },
      (h: Awaited<ReturnType<typeof harness>>) => { h.controller.setVolume(0); },
      (h: Awaited<ReturnType<typeof harness>>) => { h.activity(false); },
    ]) {
      const h = await harness(); run(FADE_IN_MS);
      h.controller.toggle(); run(FADE_OUT_MS / 2);
      h.at(0).throws = 'remove';
      expect(() => { act(h); }).not.toThrow();
      expect(h.at(0).log.slice(-2)).toEqual(['pause', 'remove']);
      expect(vi.getTimerCount() <= 1, 'at most the fade-in of a new start').toBe(true);
      expect(h.controller.state.getState().status).toBe('');
      run(5000);
      expect(h.at(0).log.at(-1), 'and it is never touched again').toBe('remove');
      h.stop();
    }
  });

  it('still lets a live player that throws on release reach its caller, as before ramps', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.at(0).throws = 'pause';
    expect(() => { h.phase(1); }).toThrow('pause failed');
    expect(h.at(0).removed).toBe(true);
    h.stop();
  });
});
