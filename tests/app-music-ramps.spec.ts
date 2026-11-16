/**
 * The controller's ramps (#88): duck, fade-out before release, fade-in. Unlike the harness in
 * app-music.spec.ts this one hands out a separate mock per created player and logs every call
 * in order, because the claims here are about which player was written to, and when.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MusicPhase } from '../src/app/musicTracks';
import { DUCK_RAMP_MS, DUCK_RATIO, FADE_IN_MS, FADE_OUT_MS, MusicController } from '../src/app/musicController';
import { RAMP_STEP_MS } from '../src/app/volumeRamp';
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { createGameStore } from '../src/app/store';
import { CONTENT } from '../src/content';
import { createInitialState } from '../src/engine';
import { memoryStorage } from './app-helpers';

interface Fake { phase: MusicPhase; log: string[]; levels: number[]; removed: boolean; status: (playing: boolean, error: boolean) => void }

async function settle() { for (let index = 0; index < 8; index++) await Promise.resolve(); }
const run = (ms: number) => { vi.advanceTimersByTime(ms); };

async function harness(volume = 40, enabled = true) {
  const storage = memoryStorage();
  storage.setItem(AUDIO_KEY, JSON.stringify({ version: 2, enabled, volume, speechEnabled: true, speechVolume: 30 }));
  const game = createGameStore();
  game.initialize(createInitialState(CONTENT), 0, null);
  const players: Fake[] = [];
  const violations: string[] = [];
  let lifecycle: (active: boolean) => void = () => undefined;
  const backend = { prepareMusic: () => Promise.resolve(), createMusicPlayer: (phase: MusicPhase, status: Fake['status']) => {
    const fake: Fake = { phase, log: [], levels: [], removed: false, status };
    // Anything at all done to a removed player is the bug this file exists to catch.
    const note = (call: string) => { if (fake.removed) violations.push(String(phase) + ':' + call); fake.log.push(call); };
    players.push(fake);
    return { play: () => { note('play'); }, pause: () => { note('pause'); },
      volume: (level: number) => { note('volume'); fake.levels.push(level); },
      remove: () => { note('remove'); fake.removed = true; } };
  } };
  const controller = new MusicController(game, { current: () => true, subscribe: (listener) => { lifecycle = listener; return () => undefined; } },
    storage, () => Promise.resolve(backend));
  const stop = controller.start();
  await settle();
  if (enabled) { controller.resume(); await settle(); }
  const phase = (next: number) => { game.dispatch((state) => ({ ok: true, state: { ...state, currentPhase: next } })); };
  const at = (index: number): Fake => {
    const fake = players[index];
    if (!fake) throw new Error('no player ' + String(index));
    return fake;
  };
  return { controller, game, storage, players, violations, stop, phase, at, activity: (active: boolean) => { lifecycle(active); },
    live: () => players.filter((fake) => !fake.removed).length };
}

function monotonic(levels: number[], rising: boolean): boolean {
  return levels.every((level, index) => index === 0 || (rising ? level >= (levels[index - 1] ?? 0) : level <= (levels[index - 1] ?? 0)));
}
/** Drop what has been written so far, so a case reads only the levels its own action caused. */
function fresh(fake: Fake): number[] { fake.levels.length = 0; return fake.levels; }

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('soundtrack ramps', () => {
  it('fades a new player in from silence to exactly the preference level', async () => {
    const h = await harness();
    const levels = h.at(0).levels;
    expect(levels, 'silent before it is started').toEqual([0]);
    expect(h.at(0).log.slice(0, 2)).toEqual(['volume', 'play']);
    run(FADE_IN_MS - RAMP_STEP_MS);
    expect(levels.at(-1)).toBeLessThan(0.4);
    run(RAMP_STEP_MS);
    expect(levels.length).toBe(1 + FADE_IN_MS / RAMP_STEP_MS);
    expect(monotonic(levels, true)).toBe(true);
    expect(levels.at(-1)).toBe(0.4);
    expect(vi.getTimerCount()).toBe(0);
    h.stop();
  });

  it('ramps the duck down and back up, each monotonic and exact', async () => {
    const h = await harness(); run(FADE_IN_MS);
    const levels = fresh(h.at(0));
    h.controller.setDucked(true);
    expect(levels, 'the duck is a ramp, not a step').toEqual([]);
    run(DUCK_RAMP_MS);
    expect(levels.length).toBe(DUCK_RAMP_MS / RAMP_STEP_MS);
    expect(monotonic(levels, false)).toBe(true);
    expect(levels[0]).toBeLessThan(0.4);
    expect(levels[0]).toBeGreaterThan(0.4 * DUCK_RATIO);
    expect(levels.at(-1)).toBe(0.4 * DUCK_RATIO);
    fresh(h.at(0));
    h.controller.setDucked(false); run(DUCK_RAMP_MS);
    expect(levels.length).toBe(DUCK_RAMP_MS / RAMP_STEP_MS);
    expect(monotonic(levels, true)).toBe(true);
    expect(levels.at(-1)).toBe(0.4);
    expect(vi.getTimerCount()).toBe(0);
    h.stop();
  });

  it('turns round mid-duck from the level it had reached', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.controller.setDucked(true); run(DUCK_RAMP_MS / 2);
    const reached = h.at(0).levels.at(-1) ?? 0;
    expect(reached).toBeGreaterThan(0.4 * DUCK_RATIO);
    const levels = fresh(h.at(0));
    h.controller.setDucked(false); run(DUCK_RAMP_MS);
    // Starting again from the old target would have dipped to the ducked level first.
    expect(Math.min(...levels)).toBeGreaterThan(reached);
    expect(monotonic(levels, true)).toBe(true);
    expect(levels.at(-1)).toBe(0.4);
    h.stop();
  });

  it('fades the old score out before releasing it, and only then creates the next one', async () => {
    const h = await harness(); run(FADE_IN_MS);
    const old = h.at(0);
    const levels = fresh(old);
    h.phase(1);
    expect(h.players.length, 'one player at a time: no crossfade').toBe(1);
    expect(old.removed).toBe(false);
    run(FADE_OUT_MS - RAMP_STEP_MS);
    expect(h.players.length).toBe(1);
    expect(old.removed).toBe(false);
    run(RAMP_STEP_MS);
    expect(monotonic(levels, false)).toBe(true);
    expect(levels.at(-1)).toBe(0);
    expect(old.log.slice(-3)).toEqual(['volume', 'pause', 'remove']);
    expect(h.players.length).toBe(2);
    expect(h.at(1).phase).toBe(1);
    expect(h.at(1).levels).toEqual([0]);
    run(FADE_IN_MS);
    expect(h.at(1).levels.at(-1)).toBe(0.4);
    expect(h.live()).toBe(1);
    expect(h.violations).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    h.stop();
  });

  it('ignores the fading player status, so it cannot report the next phase as playing', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.at(0).status(true, false);
    expect(h.controller.state.getState().playing).toBe(true);
    h.phase(1);
    expect(h.controller.state.getState()).toMatchObject({ trackPhase: 1, playing: false });
    h.at(0).status(true, false); h.at(0).status(false, true);
    expect(h.controller.state.getState()).toMatchObject({ playing: false, activated: true, status: '' });
    run(FADE_OUT_MS); h.at(1).status(true, false);
    expect(h.controller.state.getState().playing).toBe(true);
    h.stop();
  });

  it('fades out for the ending, for music switched off and for an import, then stays silent or restarts', async () => {
    const ending = await harness(); run(FADE_IN_MS);
    ending.game.dispatch((state) => ({ ok: true, state: { ...state, ending: 'evaluation' } }));
    expect(ending.at(0).removed).toBe(false);
    run(FADE_OUT_MS);
    expect(ending.at(0).levels.at(-1)).toBe(0);
    expect(ending.at(0).removed).toBe(true);
    expect(ending.players.length, 'the ending creates nothing').toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    ending.stop();

    const off = await harness(); run(FADE_IN_MS);
    off.controller.toggle();
    expect(off.at(0).removed).toBe(false);
    run(FADE_OUT_MS);
    expect(off.at(0).removed).toBe(true);
    expect(off.players.length).toBe(1);
    // Back on during the next fade-out: the new player waits for the old one to go.
    off.controller.toggle(); await settle(); run(FADE_IN_MS);
    off.controller.toggle(); off.controller.toggle(); await settle();
    expect(off.players.length).toBe(2);
    run(FADE_OUT_MS);
    expect(off.players.length).toBe(3);
    expect(off.live()).toBe(1);
    expect(off.violations).toEqual([]);
    off.stop();

    const imported = await harness(); run(FADE_IN_MS);
    imported.game.initialize(imported.game.store.getState().game, 0, null);
    expect(imported.players.length).toBe(1);
    run(FADE_OUT_MS);
    expect(imported.players.length).toBe(2);
    expect(imported.at(1).phase).toBe(0);
    imported.stop();
  });

  it('follows only the latest phase when several changes arrive during one fade-out', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.phase(1); run(FADE_OUT_MS / 2); h.phase(2); h.phase(3);
    run(FADE_OUT_MS / 2);
    expect(h.players.map((fake) => fake.phase)).toEqual([0, 3]);
    expect(h.live()).toBe(1);
    h.stop();
  });

  it('lands a volume change made mid-ramp on the new level and stores only the preference', async () => {
    const h = await harness();
    run(FADE_IN_MS / 2);
    const levels = fresh(h.at(0));
    h.controller.setVolume(80); await settle();
    expect(levels, 'the fade-in bends rather than jumping').toEqual([]);
    run(FADE_IN_MS);
    expect(monotonic(levels, true)).toBe(true);
    expect(levels.at(-1)).toBe(0.8);
    h.controller.setDucked(true); run(DUCK_RAMP_MS / 2);
    h.controller.setVolume(50); await settle(); run(DUCK_RAMP_MS);
    expect(h.at(0).levels.at(-1)).toBe(0.5 * DUCK_RATIO);
    // At rest a volume change is immediate, as it always was.
    fresh(h.at(0));
    h.controller.setVolume(60);
    expect(levels).toEqual([0.6 * DUCK_RATIO]);
    expect(vi.getTimerCount()).toBe(0);
    expect(JSON.parse(h.storage.getItem(AUDIO_KEY) ?? '')).toMatchObject({ enabled: true, volume: 60 });
    h.stop();
  });

  it('never touches the stored preference or the shown volume while ramping', async () => {
    const h = await harness(); await settle();
    const before = h.storage.getItem(AUDIO_KEY);
    const writes = h.storage.setItem.mock.calls.length;
    run(FADE_IN_MS); h.controller.setDucked(true); run(DUCK_RAMP_MS / 2); h.phase(1);
    run(FADE_OUT_MS + FADE_IN_MS); h.controller.setDucked(false); run(DUCK_RAMP_MS); await settle();
    expect(h.storage.setItem.mock.calls.length).toBe(writes);
    expect(h.storage.getItem(AUDIO_KEY)).toBe(before);
    expect(h.controller.state.getState().volume).toBe(40);
    h.stop();
  });

  it('composes a duck with a fade-in and a phase change with a duck', async () => {
    const h = await harness();
    run(FADE_IN_MS / 5);
    const reached = h.at(0).levels.at(-1) ?? 0;
    expect(reached).toBeLessThan(0.4 * DUCK_RATIO);
    const levels = fresh(h.at(0));
    // Ducked while still fading in: it carries on up from where it is, to the ducked level.
    h.controller.setDucked(true); run(FADE_IN_MS);
    expect(monotonic(levels, true)).toBe(true);
    expect(Math.min(...levels)).toBeGreaterThan(reached);
    expect(levels.at(-1)).toBe(0.4 * DUCK_RATIO);
    // A phase change while ducked: out from the ducked level, the next one in to the ducked level.
    fresh(h.at(0));
    h.phase(1); run(FADE_OUT_MS);
    expect(Math.max(...levels)).toBeLessThan(0.4 * DUCK_RATIO);
    expect(levels.at(-1)).toBe(0);
    run(FADE_IN_MS);
    expect(Math.max(...h.at(1).levels), 'no full-volume blip under the voice').toBe(0.4 * DUCK_RATIO);
    expect(h.at(1).levels.at(-1)).toBe(0.4 * DUCK_RATIO);
    // The clip ends while the next score is on its way out: the one after starts unducked.
    h.phase(2); run(FADE_OUT_MS / 2); h.controller.setDucked(false); run(FADE_OUT_MS / 2 + FADE_IN_MS);
    expect(h.at(2).levels.at(-1)).toBe(0.4);
    expect(h.violations).toEqual([]);
    h.stop();
  });

  it('writes nothing to a player after removing it, whatever arrives afterwards', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.phase(1); run(FADE_OUT_MS);
    const old = h.at(0);
    const calls = old.log.length;
    h.controller.setDucked(true); h.controller.setVolume(70); h.controller.setDucked(false);
    h.activity(false); h.activity(true); h.phase(2); run(5000);
    h.controller.toggle(); run(5000);
    h.stop(); run(5000);
    expect(old.log.length).toBe(calls);
    expect(old.log.at(-1)).toBe('remove');
    for (const fake of h.players) expect(fake.log.at(-1)).toBe('remove');
    expect(h.violations).toEqual([]);
  });

  it('stops at once when backgrounded, mid fade-out included, and fades back in on return', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.controller.setDucked(true); run(DUCK_RAMP_MS / 2);
    h.activity(false);
    expect(h.at(0).log.at(-1)).toBe('pause');
    expect(vi.getTimerCount(), 'no ramp is left waiting on a suspended app').toBe(0);
    // A duck edge while paused is remembered without a timer.
    h.controller.setDucked(false);
    expect(vi.getTimerCount()).toBe(0);
    const levels = fresh(h.at(0));
    h.activity(true); run(FADE_IN_MS);
    expect(h.players.length).toBe(1);
    expect(levels[0]).toBe(0);
    expect(levels.at(-1)).toBe(0.4);

    h.phase(1); run(FADE_OUT_MS / 2);
    h.activity(false);
    expect(h.at(0).removed, 'the fade-out is cut short, not left pending').toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(h.players.length).toBe(1);
    h.activity(true); run(FADE_IN_MS);
    expect(h.at(1).phase).toBe(1);
    expect(h.at(1).levels.at(-1)).toBe(0.4);
    expect(h.violations).toEqual([]);
    h.stop();
  });

  it('schedules nothing with music disabled or at volume zero', async () => {
    const off = await harness(40, false);
    off.controller.setDucked(true); off.controller.setVolume(50); off.phase(1); off.controller.setDucked(false);
    expect(off.players.length).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    off.stop();

    const mute = await harness(0);
    expect(mute.at(0).levels).toEqual([0]);
    mute.controller.setDucked(true); mute.controller.setDucked(false);
    expect(vi.getTimerCount()).toBe(0);
    // Nothing audible to fade: the old player goes at once and the new one starts silent.
    mute.phase(1);
    expect(mute.at(0).removed).toBe(true);
    expect(mute.players.length).toBe(2);
    expect(mute.at(1).log, 'started once, not once per pass through a zero-length fade').toEqual(['volume', 'play']);
    expect(vi.getTimerCount()).toBe(0);
    expect(new Set(mute.players.flatMap((fake) => fake.levels))).toEqual(new Set([0]));
    // Turning the level down to zero mid-ramp is a set, not a ramp to silence.
    const loud = await harness(); run(FADE_IN_MS / 2);
    loud.controller.setVolume(0);
    expect(loud.at(0).levels.at(-1)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    mute.stop(); loud.stop();
  });

  it('clears every timer on dispose, from any ramp', async () => {
    for (const midRamp of [
      (h: Awaited<ReturnType<typeof harness>>) => { run(FADE_IN_MS / 2); return h; },
      (h: Awaited<ReturnType<typeof harness>>) => { run(FADE_IN_MS); h.controller.setDucked(true); run(DUCK_RAMP_MS / 2); return h; },
      (h: Awaited<ReturnType<typeof harness>>) => { run(FADE_IN_MS); h.phase(1); run(FADE_OUT_MS / 2); return h; },
    ]) {
      const h = midRamp(await harness());
      expect(vi.getTimerCount()).toBe(1);
      h.stop();
      expect(vi.getTimerCount()).toBe(0);
      const calls = h.players.map((fake) => fake.log.length);
      run(5000);
      expect(h.players.map((fake) => fake.log.length)).toEqual(calls);
      expect(h.players.every((fake) => fake.removed)).toBe(true);
      expect(h.violations).toEqual([]);
    }
  });

  it('releases a fading player whose level write throws, and fails a live one visibly', async () => {
    const h = await harness(); run(FADE_IN_MS);
    h.phase(1); run(FADE_OUT_MS / 2);
    // Reach through the log to make the next write throw: the fake has no other seam.
    h.at(0).levels.push = () => { throw new Error('gone'); };
    run(RAMP_STEP_MS);
    expect(h.at(0).removed).toBe(true);
    expect(h.players.length, 'the next score is not left waiting').toBe(2);
    h.at(1).levels.push = () => { throw new Error('gone'); };
    run(RAMP_STEP_MS);
    expect(h.controller.state.getState()).toMatchObject({ playing: false, activated: false });
    expect(h.controller.state.getState().status).toContain('Playback unavailable');
    expect(vi.getTimerCount()).toBe(0);
    h.stop();
  });
});
