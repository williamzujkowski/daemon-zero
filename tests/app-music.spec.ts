/** Controller tests exercise real preference validation and deterministic lifecycle/player boundaries. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MusicPhase } from '../src/app/musicTracks';
import { DUCK_RATIO, FADE_IN_MS, FADE_OUT_MS, MusicController } from '../src/app/musicController';
import { AUDIO_KEY, audioPreferences, silentPreferences } from '../src/app/audioPreferences';
import { createGameStore } from '../src/app/store';
import { CONTENT } from '../src/content';
import { createInitialState } from '../src/engine';
import type { KeyValueStorage } from '../src/app/storage';
import { memoryStorage } from './app-helpers';

async function settle() { for (let index = 0; index < 8; index++) await Promise.resolve(); }
/** Levels now arrive by ramp (tests/app-music-ramps.spec.ts owns their shape); these cases are
 *  about where a level ends up, so they let whatever ramp is in flight run out first. */
function ramped() { vi.advanceTimersByTime(FADE_OUT_MS + FADE_IN_MS); }
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
/** Every case below starts from an explicit opt-out, so a default-on install is the one
 *  thing a test has to ask for; the default itself is covered separately. */
function optedOut(): KeyValueStorage {
  const storage = memoryStorage();
  storage.setItem(AUDIO_KEY, JSON.stringify(silentPreferences));
  return storage;
}

function harness(storage: KeyValueStorage = optedOut()) {
  const game = createGameStore();
  game.initialize(createInitialState(CONTENT), 0, null);
  let lifecycle: (active: boolean) => void = () => undefined;
  let update = (_playing: boolean, _error: boolean) => undefined;
  const player = { play: vi.fn(), pause: vi.fn(), remove: vi.fn(), volume: vi.fn() };
  const backend = { prepareMusic: vi.fn(() => Promise.resolve()), createMusicPlayer: vi.fn((_phase: MusicPhase, listener: typeof update) => { update = listener; return player; }) };
  const load = vi.fn(() => Promise.resolve(backend));
  const controller = new MusicController(game, { current: () => true, subscribe: (listener) => { lifecycle = listener; return vi.fn(); } }, storage, load);
  const stop = controller.start();
  return { controller, game, player, backend, load, storage, stop, activity: (active: boolean) => { lifecycle(active); }, status: (playing: boolean, error = false) => { update(playing, error); } };
}

describe('soundtrack foundation', () => {
  it('starts a fresh install with music enabled but silent until a gesture', async () => {
    const storage = memoryStorage();
    const preferences = audioPreferences(storage);
    expect(await preferences.load()).toEqual({ version: 2, enabled: true, volume: 30, speechEnabled: true, speechVolume: 30 });
    const h = harness(storage); await settle();
    expect(h.controller.state.getState().enabled).toBe(true);
    // Enabled is a preference, activation is the player's gesture: no audio yet.
    expect(h.controller.state.getState().activated).toBe(false);
    expect(h.backend.createMusicPlayer).not.toHaveBeenCalled();
    h.controller.resume(); await settle();
    expect(h.backend.createMusicPlayer).toHaveBeenCalledOnce();
    h.stop();
  });

  it('defaults silent, creates one player only after activation, and reports actual playback', async () => {
    const h = harness(); await settle();
    expect(h.load).not.toHaveBeenCalled();
    expect(h.controller.state.getState().enabled).toBe(false);
    h.controller.toggle(); await settle();
    expect(h.backend.createMusicPlayer).toHaveBeenCalledOnce();
    expect(h.controller.state.getState().playing).toBe(false);
    h.status(true); expect(h.controller.state.getState().playing).toBe(true);
    for (let index = 0; index < 30; index++) h.game.step(0.1);
    expect(h.player.play).toHaveBeenCalledOnce();
    h.controller.setVolume(0); expect(h.player.volume).toHaveBeenLastCalledWith(0);
    h.controller.toggle(); expect(h.player.remove).toHaveBeenCalledOnce();
    h.stop();
  });

  it('pauses in background, resumes one player, restarts after import/wipe and switches phases and stops on ending', async () => {
    const h = harness(); await settle(); h.controller.toggle(); await settle();
    h.activity(false); expect(h.controller.state.getState().playing).toBe(false);
    h.activity(false); h.activity(true);
    expect(h.backend.createMusicPlayer).toHaveBeenCalledOnce();
    h.game.initialize(h.game.store.getState().game, 0, null);
    expect(h.backend.createMusicPlayer).toHaveBeenCalledTimes(2);
    h.game.dispatch((game) => ({ ok: true, state: { ...game, iteration: game.iteration + 1 } }));
    expect(h.backend.createMusicPlayer).toHaveBeenCalledTimes(3);
    h.game.dispatch((game) => ({ ok: true, state: { ...game, currentPhase: 1 } }));
    expect(h.player.remove).toHaveBeenCalledTimes(3);
    h.game.dispatch((game) => ({ ok: true, state: { ...game, currentPhase: 4, ending: 'evaluation' } }));
    expect(h.backend.createMusicPlayer).toHaveBeenCalledTimes(4);
    h.stop();
  });

  it('loads enabled preference without autoplay and recovers denied playback through explicit resume', async () => {
    const storage = memoryStorage();
    storage.setItem(AUDIO_KEY, JSON.stringify({ version: 1, enabled: true, volume: 20 }));
    const h = harness(storage); await settle();
    expect(h.load).not.toHaveBeenCalled();
    h.controller.resume(); await settle(); h.status(false, true);
    expect(h.controller.state.getState()).toMatchObject({ enabled: true, activated: false, playing: false });
    expect(h.controller.state.getState().status).toContain('Try Resume');
    h.controller.resume(); await settle(); h.status(true);
    expect(h.controller.state.getState().status).toBe('');
    expect(h.controller.state.getState().playing).toBe(true);
    expect(h.backend.createMusicPlayer).toHaveBeenCalledOnce();
    h.stop();
  });

  it('rejects malformed/unbounded preferences and persists presentation settings independently', async () => {
    const storage = memoryStorage(); const preferences = audioPreferences(storage);
    for (const raw of ['oops', '{}', 'x'.repeat(257), '{"version":1,"enabled":true,"volume":101}', '{"version":1,"enabled":true,"volume":20,"extra":1}']) {
      storage.setItem(AUDIO_KEY, raw); expect(await preferences.load()).toEqual(silentPreferences);
    }
    const h = harness(storage); await settle(); h.controller.setVolume(193.4); await settle();
    // This storage held malformed entries, so it fell back to silence; the volume still clamps.
    expect(await preferences.load()).toEqual({ version: 2, enabled: false, volume: 100, speechEnabled: false, speechVolume: 30 });
    h.controller.setVolume(-10); h.controller.setVolume(Number.NaN); await settle();
    expect(h.controller.state.getState().volume).toBe(0);
    expect(storage.getItem('daemon-zero.save.v1')).toBeNull(); h.stop();
  });

  it('surfaces read/write and backend failures without rejected promises or phantom playback', async () => {
    const storage = { getItem: () => Promise.reject(new Error('denied')), setItem: () => Promise.reject(new Error('full')) };
    const h = harness(storage); await settle();
    expect(h.controller.state.getState().storageNotice).toContain('could not be loaded');
    h.load.mockRejectedValueOnce(new Error('unsupported'));
    h.controller.toggle(); await settle();
    expect(h.controller.state.getState().status).toContain('Playback unavailable');
    expect(h.controller.state.getState().storageNotice).toContain('could not be saved');
    h.controller.resume(); await settle();
    h.player.play.mockImplementationOnce(() => { throw new Error('play failed'); });
    h.controller.resume(); await settle();
    expect(h.controller.state.getState().playing).toBe(false); h.stop();
  });

  it('does not create a player when unmounted or disabled during asynchronous activation', async () => {
    const h = harness(); await settle();
    h.controller.toggle(); h.controller.toggle(); await settle();
    expect(h.backend.createMusicPlayer).not.toHaveBeenCalled();
    h.stop();
    const pending = harness(); await settle();
    pending.controller.toggle(); pending.stop(); await settle();
    expect(pending.backend.createMusicPlayer).not.toHaveBeenCalled();
  });
});

it('ignores removed-player status and delayed preparation after phase change or disposal', async () => {
  const h = harness();
  h.controller.toggle(); expect(h.load).not.toHaveBeenCalled();
  await settle(); h.controller.toggle(); await settle();
  const old = h.backend.createMusicPlayer.mock.calls[0]?.[1];
  h.game.initialize(h.game.store.getState().game, 0, null);
  h.status(true); old?.(false, true);
  expect(h.controller.state.getState().playing).toBe(true);
  h.stop(); old?.(true, false);
  expect(h.controller.state.getState().playing).toBe(false);
  const pending = harness(); await settle();
  let resolve: () => void = () => undefined;
  pending.backend.prepareMusic.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
  pending.controller.toggle(); await settle();
  pending.game.dispatch((game) => ({ ok: true, state: { ...game, currentPhase: 1 } }));
  resolve(); await settle();
  expect(pending.backend.createMusicPlayer).toHaveBeenCalledWith(1, expect.any(Function)); pending.stop();
});

it('rejects obsolete preparation failures after a newer start succeeds or music is disabled', async () => {
  const h = harness(); await settle();
  let reject: (error: Error) => void = () => undefined;
  h.backend.prepareMusic.mockImplementationOnce(() => new Promise<void>((_done, fail) => { reject = fail; }));
  h.controller.toggle(); await settle(); h.controller.resume(); await settle(); h.status(true);
  reject(new Error('obsolete')); await settle();
  expect(h.controller.state.getState()).toMatchObject({ playing: true, activated: true, status: '' });
  h.stop();
  const disabled = harness(); await settle();
  disabled.backend.prepareMusic.mockImplementationOnce(() => new Promise<void>((_done, fail) => { reject = fail; }));
  disabled.controller.toggle(); await settle(); disabled.controller.toggle();
  reject(new Error('disabled')); await settle();
  expect(disabled.controller.state.getState()).toMatchObject({ playing: false, activated: false, status: '' });
  disabled.stop();
});

it('reconciles the latest eligible imported run after pending backend preparation succeeds', async () => {
  const h = harness(); await settle();
  let resolve: () => void = () => undefined;
  h.backend.prepareMusic.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
  h.controller.toggle(); await settle();
  h.game.initialize(h.game.store.getState().game, 0, null);
  resolve(); await settle();
  expect(h.backend.createMusicPlayer).toHaveBeenCalledOnce();
  expect(h.player.play).toHaveBeenCalledOnce();
  h.stop();
});

it('switches one current-phase player for all six phases and ignores every removed listener', async () => {
  const h = harness(); await settle(); h.controller.toggle(); await settle();
  for (const phase of [0, 1, 2, 3, 4, 5]) {
    const old = h.backend.createMusicPlayer.mock.lastCall?.[1];
    const before = h.backend.createMusicPlayer.mock.calls.length;
    h.game.initialize({ ...h.game.store.getState().game, currentPhase: phase }, 0, null);
    expect(h.backend.createMusicPlayer).toHaveBeenCalledTimes(before + 1);
    expect(h.backend.createMusicPlayer.mock.lastCall?.[0]).toBe(phase);
    expect(h.controller.state.getState()).toMatchObject({ trackPhase: phase, playing: false });
    h.status(true); old?.(false, true);
    expect(h.controller.state.getState()).toMatchObject({ trackPhase: phase, playing: true, activated: true, status: '' });
  }
  h.game.initialize({ ...h.game.store.getState().game, currentPhase: 0, iteration: 2 }, 0, null);
  expect(h.backend.createMusicPlayer.mock.lastCall?.[0]).toBe(0);
  h.game.dispatch((game) => ({ ok: true, state: { ...game, currentPhase: 99 } }));
  expect(h.controller.state.getState()).toMatchObject({ trackPhase: null, playing: false });
  h.stop();
});

it('reconciles only the latest phase when preparation completes after several transitions and backgrounding', async () => {
  const h = harness(); await settle();
  let resolve: () => void = () => undefined;
  h.backend.prepareMusic.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
  h.controller.toggle(); await settle();
  for (const phase of [2, 4, 5]) h.game.initialize({ ...h.game.store.getState().game, currentPhase: phase }, 0, null);
  h.activity(false); resolve(); await settle();
  expect(h.backend.createMusicPlayer).not.toHaveBeenCalled();
  h.activity(true);
  expect(h.backend.createMusicPlayer).toHaveBeenCalledOnce();
  expect(h.backend.createMusicPlayer.mock.lastCall?.[0]).toBe(5);
  h.stop();
});

it('does not let obsolete preparation failures pause a newer phase player', async () => {
  const h = harness(); await settle();
  let reject: (error: Error) => void = () => undefined;
  h.backend.prepareMusic.mockImplementationOnce(() => new Promise<void>((_done, fail) => { reject = fail; }));
  h.controller.toggle(); await settle();
  h.game.initialize({ ...h.game.store.getState().game, currentPhase: 5 }, 0, null);
  h.controller.resume(); await settle(); h.status(true);
  reject(new Error('old phase initialization')); await settle();
  expect(h.backend.createMusicPlayer).toHaveBeenCalledOnce();
  expect(h.backend.createMusicPlayer.mock.lastCall?.[0]).toBe(5);
  expect(h.controller.state.getState()).toMatchObject({ trackPhase: 5, playing: true, status: '' });
  h.stop();
});

/** Ducking under a spoken transmission (#88): the controller scales what it writes to the
 *  player and nothing else, so the preference a player chose is what gets stored. */
describe('ducking under speech', () => {
  async function playing(volume = 40) {
    const storage = memoryStorage();
    storage.setItem(AUDIO_KEY, JSON.stringify({ version: 1, enabled: true, volume }));
    const h = harness(storage); await settle();
    h.controller.resume(); await settle(); ramped();
    return h;
  }

  it('drops the live player to the duck ratio and restores the preference level', async () => {
    const h = await playing();
    expect(h.player.volume).toHaveBeenLastCalledWith(0.4);
    h.controller.setDucked(true); ramped();
    expect(h.player.volume).toHaveBeenLastCalledWith(0.4 * DUCK_RATIO);
    const writes = h.player.volume.mock.calls.length;
    h.controller.setDucked(true); ramped();
    expect(h.player.volume, 'a repeated signal writes nothing').toHaveBeenCalledTimes(writes);
    h.controller.setDucked(false); ramped();
    expect(h.player.volume).toHaveBeenLastCalledWith(0.4);
    h.stop();
  });

  it('keeps a volume change made while ducked ducked, and stores the undiminished preference', async () => {
    const h = await playing();
    h.controller.setDucked(true);
    h.controller.setVolume(80); await settle(); ramped();
    expect(h.player.volume).toHaveBeenLastCalledWith(0.8 * DUCK_RATIO);
    expect(h.controller.state.getState().volume).toBe(80);
    // The stored v1 value migrated with speech at the old shared level; only the music level moved.
    expect(await audioPreferences(h.storage).load()).toEqual({ version: 2, enabled: true, volume: 80, speechEnabled: true, speechVolume: 40 });
    h.controller.setDucked(false); ramped();
    expect(h.player.volume).toHaveBeenLastCalledWith(0.8);
    h.stop();
  });

  it('never writes the ducked level to the saved preference', async () => {
    const h = await playing();
    const before = h.storage.getItem(AUDIO_KEY);
    h.controller.setDucked(true); h.controller.setDucked(false); h.controller.setDucked(true); await settle();
    expect(h.storage.getItem(AUDIO_KEY)).toBe(before);
    expect(h.controller.state.getState().volume).toBe(40);
    h.stop();
  });

  it('creates the next phase player already ducked, and one created idle at full level', async () => {
    const h = await playing();
    h.controller.setDucked(true); ramped();
    h.player.volume.mockClear();
    h.game.dispatch((game) => ({ ok: true, state: { ...game, currentPhase: 1 } }));
    expect(h.backend.createMusicPlayer).toHaveBeenCalledTimes(2);
    ramped();
    // The new player never goes above the ducked level on its way in: no full-volume blip.
    const levels = h.player.volume.mock.calls.map(([level]) => Number(level));
    expect(Math.max(...levels)).toBe(0.4 * DUCK_RATIO);
    expect(levels.at(-1)).toBe(0.4 * DUCK_RATIO);
    h.controller.setDucked(false);
    h.game.dispatch((game) => ({ ok: true, state: { ...game, currentPhase: 2 } })); ramped();
    expect(h.player.volume).toHaveBeenLastCalledWith(0.4);
    h.stop();
  });

  it('remembers a duck that arrives with no player, so music enabled mid-clip starts ducked', async () => {
    const h = harness(); await settle();
    h.controller.setDucked(true);
    expect(h.player.volume).not.toHaveBeenCalled();
    h.controller.toggle(); await settle(); ramped();
    expect(h.player.volume).toHaveBeenLastCalledWith(silentPreferences.volume / 100 * DUCK_RATIO);
    h.stop();
  });

  it('ducks to a fraction that leaves the score audible', () => {
    expect(DUCK_RATIO).toBeGreaterThan(0);
    expect(DUCK_RATIO).toBeLessThan(1);
  });
});
