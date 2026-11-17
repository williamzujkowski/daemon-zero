/**
 * Two React roots can hold the one process-wide controller at once: Android recreates the
 * activity (a font-size change) and mounts the new root before the old root's effect cleanup
 * runs. These cases model that order on the controller directly; they do not exercise Android.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MusicPhase } from '../src/app/musicTracks';
import { FADE_IN_MS, MusicController } from '../src/app/musicController';
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { createGameStore } from '../src/app/store';
import { CONTENT } from '../src/content';
import { createInitialState } from '../src/engine';
import { memoryStorage, movingPlayhead } from './app-helpers';

const STORED = { version: 2, enabled: true, volume: 40, speechEnabled: true, speechVolume: 30 };
async function settle() { for (let index = 0; index < 8; index++) await Promise.resolve(); }

function harness() {
  const storage = memoryStorage();
  storage.setItem(AUDIO_KEY, JSON.stringify(STORED));
  const game = createGameStore();
  game.initialize(createInitialState(CONTENT), 0, null);
  const listeners = new Set<(active: boolean) => void>();
  const players: { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; volume: ReturnType<typeof vi.fn>; status: (playing: boolean, error: boolean) => void }[] = [];
  const backend = { prepareMusic: () => Promise.resolve(), createMusicPlayer: (_phase: MusicPhase, status: (playing: boolean, error: boolean) => void) => {
    const player = { ...movingPlayhead(), play: vi.fn(), pause: vi.fn(), remove: vi.fn(), volume: vi.fn(), status };
    players.push(player);
    return player;
  } };
  const controller = new MusicController(game, { current: () => true,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; } }, storage, () => Promise.resolve(backend));
  const state = () => controller.state.getState();
  return { controller, game, storage, players, listeners, state };
}

/** What MENU > Audio and READ need: the stored preference on screen and a score that starts. */
async function expectUsable(h: ReturnType<typeof harness>) {
  await settle();
  // `loaded` is what enables every control on the Audio page; `speechEnabled` is what offers READ.
  expect(h.state()).toMatchObject({ loaded: true, enabled: true, volume: 40, speechEnabled: true, speechVolume: 30 });
  h.controller.toggleSpeech();
  expect(h.state().speechEnabled, 'the speech switch still answers').toBe(false);
  h.controller.toggleSpeech();
  h.controller.setVolume(50);
  await settle();
  expect(JSON.parse(h.storage.getItem(AUDIO_KEY) ?? '{}'), 'and still saves').toMatchObject({ volume: 50, speechEnabled: true });
  expect(h.state().storageNotice).toBe('');
  h.controller.resume(); await settle();
  const player = h.players.at(-1);
  expect(player?.play, 'a start after the overlap still plays').toHaveBeenCalled();
  expect(player?.remove).not.toHaveBeenCalled();
  player?.status(true, false);
  expect(h.state(), 'and its playback is reported').toMatchObject({ playing: true, activated: true, status: '' });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('one controller, two roots', () => {
  it('survives the old root cleaning up after the new root has started, before the preference loads', async () => {
    const h = harness();
    const stopA = h.controller.start();
    const stopB = h.controller.start();
    // No await between them: B's preference load is still pending when A is torn down.
    stopA();
    await expectUsable(h);
    stopB();
  });

  it('survives the old root cleaning up after the new root is already playing', async () => {
    const h = harness();
    const stopA = h.controller.start(); await settle();
    const stopB = h.controller.start(); await settle();
    h.controller.resume(); await settle();
    vi.advanceTimersByTime(FADE_IN_MS);
    const player = h.players.at(-1);
    player?.status(true, false);
    stopA();
    expect(player?.remove, 'the new root keeps its player').not.toHaveBeenCalled();
    expect(player?.pause).not.toHaveBeenCalled();
    expect(h.state()).toMatchObject({ playing: true, activated: true, loaded: true });
    // The lifecycle still reaches it: a background and return pauses and resumes the same player.
    for (const listener of [...h.listeners]) listener(false);
    expect(player?.pause).toHaveBeenCalledOnce();
    for (const listener of [...h.listeners]) listener(true);
    expect(player?.play).toHaveBeenCalledTimes(2);
    await expectUsable(h);
    stopB();
  });

  it('hands over cleanly: the new start releases the old root\'s player and each cleanup drops only its own subscriptions', async () => {
    const h = harness();
    const stopA = h.controller.start(); await settle();
    h.controller.resume(); await settle();
    const first = h.players[0];
    expect(first?.play).toHaveBeenCalledOnce();
    const stopB = h.controller.start();
    // The state was reset for the new root, so a player left sounding would contradict it.
    expect(first?.remove).toHaveBeenCalledOnce();
    expect(h.state()).toMatchObject({ playing: false, activated: false, loaded: false });
    expect(h.listeners.size).toBe(2);
    stopA();
    expect(h.listeners.size, 'A leaves, B stays subscribed').toBe(1);
    await expectUsable(h);
    stopB();
    expect(h.listeners.size).toBe(0);
    expect(h.players.at(-1)?.remove, 'the last cleanup is the one that tears down').toHaveBeenCalledOnce();
    expect(h.state()).toMatchObject({ playing: false, activated: false });
    expect(vi.getTimerCount(), 'and leaves no ramp timer behind').toBe(0);
  });

  it('keeps the plain order working: start, cleanup, start', async () => {
    const h = harness();
    const stopA = h.controller.start(); await settle();
    h.controller.resume(); await settle();
    stopA();
    expect(h.players[0]?.remove).toHaveBeenCalledOnce();
    expect(h.listeners.size).toBe(0);
    const stopB = h.controller.start();
    await expectUsable(h);
    expect(h.players.length).toBe(2);
    stopB();
  });

  it('treats a second run of the same cleanup as nothing, even after a later start', async () => {
    const h = harness();
    const stopA = h.controller.start(); await settle();
    stopA(); stopA();
    const stopB = h.controller.start();
    stopA();
    await expectUsable(h);
    stopB(); stopB();
    expect(h.listeners.size).toBe(0);
    expect(h.players.at(-1)?.remove).toHaveBeenCalledOnce();
    // Torn down for real: nothing answers until the next start.
    h.controller.resume(); await settle();
    expect(h.players.at(-1)?.play).toHaveBeenCalledOnce();
  });

  it('ignores an activation still in flight for the root that was replaced', async () => {
    const h = harness();
    const stopA = h.controller.start(); await settle();
    h.controller.resume();
    // A's backend load has not settled when B starts: it must not start a score B never asked for.
    const stopB = h.controller.start(); await settle();
    expect(h.players.length).toBe(0);
    expect(h.state()).toMatchObject({ activated: false, playing: false, loaded: true });
    stopA();
    await expectUsable(h);
    stopB();
  });
});
