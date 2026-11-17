/**
 * Media keys, lock screens and headset buttons. Two routes reach the controller: `remote()`,
 * which the web session's handlers call, and plain status reports, which on Android are the
 * only news of a key the platform already applied to the native player. Either way the result
 * must be the state the in-app controls produce, and nothing may start in the background.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { DUCK_RATIO, FADE_IN_MS } from '../src/app/musicController';
import { OUTSIDE_PAUSE_CONFIRM_MS, OutsideWatch } from '../src/app/outsideControl';
import { fresh, harness, monotonic, run, settle } from './music-ramp-harness';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const stored = (h: Awaited<ReturnType<typeof harness>>) => JSON.parse(String(h.storage.getItem(AUDIO_KEY))) as { enabled: boolean };
const state = (h: Awaited<ReturnType<typeof harness>>) => h.controller.state.getState();
const count = (log: string[], call: string) => log.filter((entry) => entry === call).length;

describe('remote play and pause', () => {
  it('pauses for the session only: the preference stays on and the page offers Resume', async () => {
    const h = await harness(); run(FADE_IN_MS); h.at(0).status(true, false);
    expect(state(h).playing).toBe(true);
    h.controller.remote('pause');
    expect(h.at(0).log.at(-1)).toBe('pause');
    expect(state(h)).toMatchObject({ enabled: true, activated: false, playing: false, status: '' });
    // Not a preference change: what `toggle()` would have stored is untouched.
    await settle();
    expect(stored(h).enabled).toBe(true);
    expect(h.live(), 'the player is kept for the resume').toBe(1);
    h.stop();
  });

  it('resumes through the same path as RESUME MUSIC: one player, faded in from silence, ducked if a clip talks', async () => {
    const h = await harness(40); run(FADE_IN_MS);
    h.controller.remote('pause');
    h.controller.setDucked(true);
    const levels = fresh(h.at(0));
    h.controller.remote('play'); await settle();
    expect(state(h).activated).toBe(true);
    expect(h.players).toHaveLength(1);
    expect(h.at(0).log.at(-1)).toBe('play');
    run(FADE_IN_MS);
    expect(levels[0]).toBe(0);
    expect(monotonic(levels, true)).toBe(true);
    expect(levels.at(-1)).toBeCloseTo(0.4 * DUCK_RATIO);
    h.stop();
  });

  it('does nothing while music is switched off: a key is not the switch', async () => {
    const h = await harness(40, false);
    h.controller.remote('play'); await settle();
    expect(state(h)).toMatchObject({ enabled: false, activated: false });
    expect(h.players).toHaveLength(0);
    h.controller.remote('pause');
    expect(stored(h).enabled).toBe(false);
    h.stop();
  });

  it('drops a play that arrives in the background, and does not start by itself on return', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.controller.remote('pause');
    h.activity(false);
    const before = count(h.at(0).log, 'play');
    h.controller.remote('play'); await settle();
    expect(state(h).activated).toBe(false);
    expect(count(h.at(0).log, 'play')).toBe(before);
    h.activity(true); await settle();
    expect(count(h.at(0).log, 'play'), 'the dropped key is not remembered').toBe(before);
    h.stop();
  });

  it('a pause during a still-loading activation wins over it', async () => {
    const h = await harness(40, false);
    h.controller.toggle();
    h.controller.remote('pause');
    await settle();
    expect(h.players, 'no player was created for a score paused before it loaded').toHaveLength(0);
    expect(state(h)).toMatchObject({ enabled: true, activated: false });
    h.stop();
  });
});

describe('a key the platform applied to the native player first', () => {
  it('adopts a confirmed outside pause as the session pause, so a phase change does not restart the score', async () => {
    const h = await harness(); run(FADE_IN_MS); h.at(0).status(true, false, false);
    h.at(0).status(false, false, true);
    expect(state(h).playing).toBe(false);
    expect(state(h).activated, 'not believed until it has lasted').toBe(true);
    run(OUTSIDE_PAUSE_CONFIRM_MS);
    expect(state(h)).toMatchObject({ enabled: true, activated: false, playing: false });
    await settle();
    expect(stored(h).enabled).toBe(true);
    h.phase(1);
    expect(h.players, 'the paused score is not replaced by a playing one').toHaveLength(1);
    h.stop();
  });

  it('does not mistake buffering, a start-up report or a short gap for a pause', async () => {
    const h = await harness(); run(FADE_IN_MS);
    // Before the player was ever heard sounding: Android reports "not playing" while it prepares.
    h.at(0).status(false, false, true); run(OUTSIDE_PAUSE_CONFIRM_MS);
    expect(state(h).activated).toBe(true);
    h.at(0).status(true, false, false);
    // Buffering: not playing, but not held either.
    h.at(0).status(false, false, false); run(OUTSIDE_PAUSE_CONFIRM_MS);
    expect(state(h).activated).toBe(true);
    // Held, then sounding again inside the window.
    h.at(0).status(true, false, false); h.at(0).status(false, false, true);
    run(OUTSIDE_PAUSE_CONFIRM_MS - 1); h.at(0).status(true, false, false); run(OUTSIDE_PAUSE_CONFIRM_MS);
    expect(state(h)).toMatchObject({ activated: true, playing: true });
    h.stop();
  });

  it('lets the lifecycle explain a pause: backgrounding inside the window is not the player pausing', async () => {
    const h = await harness(); run(FADE_IN_MS); h.at(0).status(true, false, false);
    // Android pauses its players as the activity leaves; that status can beat the AppState event.
    h.at(0).status(false, false, true);
    h.activity(false);
    run(OUTSIDE_PAUSE_CONFIRM_MS);
    expect(state(h).activated).toBe(true);
    const before = count(h.at(0).log, 'play');
    h.activity(true);
    expect(count(h.at(0).log, 'play'), 'so the score comes back with the app').toBe(before + 1);
    h.stop();
  });

  it('pause key, then play key: the second is adopted although the app\'s own pause reported nothing', async () => {
    const h = await harness(40); run(FADE_IN_MS); h.at(0).status(true, false, false);
    h.at(0).status(false, false, true); run(OUTSIDE_PAUSE_CONFIRM_MS);
    expect(state(h).activated).toBe(false);
    h.at(0).status(true, false, false); await settle();
    expect(state(h)).toMatchObject({ activated: true, status: '' });
    expect(h.at(0).log.at(-1)).toBe('play');
    h.stop();
  });

  it('adopts an outside start as Resume when resuming is all it would take', async () => {
    const h = await harness(40); run(FADE_IN_MS); h.at(0).status(true, false, false);
    h.controller.remote('pause'); h.at(0).status(false, false, true);
    const levels = fresh(h.at(0));
    h.at(0).status(true, false, false); await settle();
    expect(state(h)).toMatchObject({ activated: true, status: '' });
    run(FADE_IN_MS);
    expect(levels[0]).toBe(0);
    expect(levels.at(-1)).toBeCloseTo(0.4);
    h.at(0).status(true, false, false);
    expect(state(h).playing).toBe(true);
    h.stop();
  });

  it('stops a player that something started while the app is in the background', async () => {
    const h = await harness(); run(FADE_IN_MS); h.at(0).status(true, false, false);
    h.activity(false); h.at(0).status(false, false, true);
    const before = count(h.at(0).log, 'pause');
    h.at(0).status(true, false, false);
    expect(count(h.at(0).log, 'pause'), 'paused again at once').toBe(before + 1);
    expect(state(h).playing).toBe(false);
    // And again, however often the key is pressed.
    h.at(0).status(false, false, true); h.at(0).status(true, false, false);
    expect(count(h.at(0).log, 'pause')).toBe(before + 2);
    h.stop();
  });

  it('treats a "playing" report that trails its own pause as an echo, not as a start', async () => {
    const h = await harness(); run(FADE_IN_MS); h.at(0).status(true, false, false);
    h.controller.remote('pause');
    // The periodic status the native side queued just before the pause landed.
    h.at(0).status(true, false, false); await settle();
    expect(state(h).activated, 'a pause is not undone by its own tail').toBe(false);
    expect(h.at(0).log.at(-1)).toBe('pause');
    h.stop();
  });

  it('has nothing left to start once music is off or the run has ended: the player is released', async () => {
    const off = await harness(); run(FADE_IN_MS);
    off.controller.setVolume(0); off.controller.toggle();
    expect(off.at(0).removed).toBe(true);
    off.at(0).status(true, false, false);
    expect(off.violations, 'a released player is never touched again').toEqual([]);
    expect(state(off)).toMatchObject({ enabled: false, playing: false });
    off.stop();
    const ended = await harness(); run(FADE_IN_MS); ended.controller.remote('pause');
    ended.end();
    expect(ended.at(0).removed).toBe(true);
    ended.controller.remote('play'); await settle();
    expect(ended.players).toHaveLength(1);
    expect(state(ended).playing).toBe(false);
    ended.stop();
  });
});

describe('OutsideWatch', () => {
  it('fires once per believed pause and never after the app stops or restarts the player', () => {
    const paused = vi.fn(), watch = new OutsideWatch(paused);
    watch.started(); watch.wanted(true, false); watch.wanted(false, true); watch.wanted(false, true);
    run(OUTSIDE_PAUSE_CONFIRM_MS * 3);
    expect(paused).toHaveBeenCalledOnce();
    watch.wanted(true, false); watch.wanted(false, true); watch.stopped(); run(OUTSIDE_PAUSE_CONFIRM_MS);
    watch.wanted(true, false); watch.wanted(false, true); watch.started(); run(OUTSIDE_PAUSE_CONFIRM_MS);
    expect(paused).toHaveBeenCalledOnce();
  });

  it('calls a start an echo until the player has been heard paused', () => {
    const watch = new OutsideWatch(() => undefined);
    watch.started(); watch.wanted(true, false); watch.stopped();
    expect(watch.unwanted(true, false)).toBe('stale');
    // Buffering is not a pause, so it settles nothing.
    expect(watch.unwanted(false, false)).toBeNull();
    expect(watch.unwanted(true, false)).toBe('stale');
    expect(watch.unwanted(false, true)).toBeNull();
    expect(watch.unwanted(true, false)).toBe('started');
    expect(watch.unwanted(true, false), 'one start per pause').toBe('stale');
  });

  it('remembers a pause it was told about before the app stopped the player', () => {
    // An adopted outside pause: the player is already paused, so the app's own pause() makes
    // no new report, and the next "playing" one is a real start (seen on the emulator).
    const watch = new OutsideWatch(() => { watch.stopped(); });
    watch.started(); watch.wanted(true, false); watch.wanted(false, true);
    run(OUTSIDE_PAUSE_CONFIRM_MS);
    expect(watch.unwanted(true, false)).toBe('started');
  });
});
