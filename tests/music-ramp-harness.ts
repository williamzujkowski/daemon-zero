/**
 * A controller harness for the ramp specs. Unlike the one in app-music.spec.ts it hands out a
 * separate mock per created player and logs every call in order, because the claims those
 * specs make are about which player was written to, and when.
 */
import { beforeEach, vi } from 'vitest';
import type { MusicPhase } from '../src/app/musicTracks';
import type { Playhead } from '../src/app/loopSeam';
import { MusicController } from '../src/app/musicController';
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { createGameStore } from '../src/app/store';
import { CONTENT } from '../src/content';
import { createInitialState } from '../src/engine';
import { memoryStorage, movingPlayhead } from './app-helpers';

export interface Fake { throws: string | null; phase: MusicPhase; log: string[]; levels: number[]; removed: boolean; status: (playing: boolean, error: boolean, held?: boolean) => void }

/** Every fake made in the current case, across harnesses. */
let made: Fake[] = [];
beforeEach(() => { made = []; });

/**
 * Pending timers other than the loop-seam watch: a started player keeps one slow position poll
 * for as long as it plays (`loopSeam.ts`), so the plain timer count no longer says whether a
 * ramp is left scheduled. A fake is being watched when the last of its play, pause and remove
 * calls was a play: the controller starts the watch with `play()` and ends it with the others.
 */
export function rampTimers(): number {
  const watched = made.filter((fake) => fake.log.filter((call) => call !== 'volume').at(-1) === 'play').length;
  return vi.getTimerCount() - watched;
}

export async function settle() { for (let index = 0; index < 8; index++) await Promise.resolve(); }
export const run = (ms: number) => { vi.advanceTimersByTime(ms); };

/** `playhead` makes each player's position and length; by default the fade-in opens on its first tick. */
export async function harness(volume = 40, enabled = true, playhead: () => Playhead = movingPlayhead) {
  const storage = memoryStorage();
  storage.setItem(AUDIO_KEY, JSON.stringify({ version: 2, enabled, volume, speechEnabled: true, speechVolume: 30 }));
  const game = createGameStore();
  game.initialize(createInitialState(CONTENT), 0, null);
  const players: Fake[] = [];
  const violations: string[] = [];
  let lifecycle: (active: boolean) => void = () => undefined;
  const backend = { prepareMusic: () => Promise.resolve(), createMusicPlayer: (phase: MusicPhase, status: Fake['status']) => {
    const fake: Fake = { throws: null, phase, log: [], levels: [], removed: false, status };
    // Anything at all done to a removed player is the bug this file exists to catch.
    const note = (call: string) => {
      if (fake.removed) violations.push(String(phase) + ':' + call);
      fake.log.push(call);
      // Set by a case that needs the backend to fail at one call.
      if (fake.throws === call) throw new Error(call + ' failed');
    };
    players.push(fake); made.push(fake);
    return { ...playhead(), play: () => { note('play'); }, pause: () => { note('pause'); },
      volume: (level: number) => { note('volume'); fake.levels.push(level); },
      remove: () => { note('remove'); fake.removed = true; } };
  } };
  const controller = new MusicController(game, { current: () => true, subscribe: (listener) => { lifecycle = listener; return () => undefined; } },
    storage, () => Promise.resolve(backend));
  const stop = controller.start();
  await settle();
  if (enabled) { controller.resume(); await settle(); }
  const end = () => { game.dispatch((state) => ({ ok: true, state: { ...state, ending: 'evaluation' } })); };
  const phase = (next: number) => { game.dispatch((state) => ({ ok: true, state: { ...state, currentPhase: next } })); };
  const at = (index: number): Fake => {
    const fake = players[index];
    if (!fake) throw new Error('no player ' + String(index));
    return fake;
  };
  return { controller, game, storage, players, violations, stop, phase, end, at, activity: (active: boolean) => { lifecycle(active); },
    live: () => players.filter((fake) => !fake.removed).length };
}

/** Shared with the scheduler's own spec: never a step against the direction of travel. */
export function monotonic(levels: number[], rising: boolean): boolean {
  return levels.every((level, index) => index === 0 || (rising ? level >= (levels[index - 1] ?? 0) : level <= (levels[index - 1] ?? 0)));
}
/** Drop what has been written so far, so a case reads only the levels its own action caused. */
export function fresh(fake: Fake): number[] { fake.levels.length = 0; return fake.levels; }
