/**
 * The stored audio preference is untrusted input with two accepted shapes: the current one,
 * and the single-switch one it replaced. These pin the parser, the migration rule and the
 * controller's speech half, which must never reach for the soundtrack backend.
 */
import { describe, expect, it, vi } from 'vitest';
import { AUDIO_KEY, audioPreferences, defaultPreferences, parseAudioPreferences, silentPreferences } from '../src/app/audioPreferences';
import { MusicController } from '../src/app/musicController';
import { createGameStore } from '../src/app/store';
import { CONTENT } from '../src/content';
import { createInitialState } from '../src/engine';
import { memoryStorage } from './app-helpers';

async function settle() { for (let index = 0; index < 8; index++) await Promise.resolve(); }
const v2 = { version: 2, enabled: false, volume: 20, speechEnabled: true, speechVolume: 70 };

function harness(initial: unknown) {
  const storage = memoryStorage();
  if (initial !== undefined) storage.setItem(AUDIO_KEY, JSON.stringify(initial));
  const game = createGameStore();
  game.initialize(createInitialState(CONTENT), 0, null);
  const load = vi.fn(() => Promise.reject(new Error('the soundtrack backend must not be loaded for speech')));
  const controller = new MusicController(game, { current: () => true, subscribe: () => vi.fn() }, storage, load);
  const stop = controller.start();
  const stored = () => JSON.parse(storage.getItem(AUDIO_KEY) ?? 'null') as unknown;
  return { controller, storage, load, stop, stored, state: () => controller.state.getState() };
}

describe('audio preference parsing', () => {
  it('accepts an exact v2 value, with speech and music independent', () => {
    expect(parseAudioPreferences(v2)).toEqual(v2);
    expect(parseAudioPreferences({ ...v2, enabled: true, speechEnabled: false })).toEqual({ ...v2, enabled: true, speechEnabled: false });
  });

  it.each([[true, 0], [true, 100], [false, 45]])('migrates v1 enabled=%s volume=%s so speech inherits both', (enabled, volume) => {
    // One switch and one level used to cover both; inheriting them changes nobody's sound.
    expect(parseAudioPreferences({ version: 1, enabled, volume }))
      .toEqual({ version: 2, enabled, volume, speechEnabled: enabled, speechVolume: volume });
  });

  it.each([
    ['a v2 missing a speech field', { version: 2, enabled: true, volume: 30, speechEnabled: true }],
    ['a v2 with an unknown key', { ...v2, extra: 1 }],
    ['a v2 speech level out of range', { ...v2, speechVolume: 101 }],
    ['a v2 fractional speech level', { ...v2, speechVolume: 30.5 }],
    ['a v2 non-boolean speech switch', { ...v2, speechEnabled: 'yes' }],
    ['a v1 carrying speech fields', { version: 1, enabled: true, volume: 30, speechEnabled: true, speechVolume: 30 }],
    ['a v1 body claiming version 2', { version: 2, enabled: true, volume: 30 }],
    ['a v1 with an unknown key', { version: 1, enabled: true, volume: 30, extra: 1 }],
    ['a v1 level out of range', { version: 1, enabled: true, volume: -1 }],
    ['an unknown version', { version: 3, enabled: true, volume: 30, speechEnabled: true, speechVolume: 30 }],
    ['a string version', { version: '2', enabled: true, volume: 30, speechEnabled: true, speechVolume: 30 }],
    ['null', null], ['an array', [2, true, 30, true, 30]], ['a number', 2], ['a string', 'on'],
  ])('falls back to silence, speech included, for %s', (_name, value) => {
    expect(parseAudioPreferences(value)).toEqual(silentPreferences);
    expect(silentPreferences.speechEnabled).toBe(false);
  });

  it('loads a stored v1 migrated, a stored v2 as written, and nothing as the default-on install', async () => {
    const storage = memoryStorage(), preferences = audioPreferences(storage);
    expect(await preferences.load()).toEqual(defaultPreferences);
    expect(defaultPreferences).toMatchObject({ version: 2, speechEnabled: true, speechVolume: 30 });
    storage.setItem(AUDIO_KEY, JSON.stringify({ version: 1, enabled: false, volume: 55 }));
    expect(await preferences.load()).toEqual({ version: 2, enabled: false, volume: 55, speechEnabled: false, speechVolume: 55 });
    storage.setItem(AUDIO_KEY, JSON.stringify(v2));
    expect(await preferences.load()).toEqual(v2);
    for (const raw of ['{"version":2', JSON.stringify({ ...v2, pad: 'x'.repeat(300) }), JSON.stringify(v2) + ' '.repeat(257)]) {
      storage.setItem(AUDIO_KEY, raw); expect(await preferences.load()).toEqual(silentPreferences);
    }
  });

  it('refuses to write a value the parser would not read back', () => {
    const preferences = audioPreferences(memoryStorage());
    expect(() => preferences.save({ ...defaultPreferences, speechVolume: 101 })).toThrow();
    expect(() => preferences.save({ version: 1, enabled: true, volume: 30 } as never)).toThrow();
  });
});

describe('speech half of the stored preference', () => {
  it('exposes a migrated v1 and rewrites the slot as v2 on the first change, never before', async () => {
    const h = harness({ version: 1, enabled: true, volume: 40 }); await settle();
    expect(h.state()).toMatchObject({ loaded: true, enabled: true, volume: 40, speechEnabled: true, speechVolume: 40 });
    // Loading is a read: the migration is deterministic, so nothing needs writing until a choice is made.
    expect(h.stored()).toEqual({ version: 1, enabled: true, volume: 40 });
    h.controller.setSpeechVolume(60); await settle();
    expect(h.stored()).toEqual({ version: 2, enabled: true, volume: 40, speechEnabled: true, speechVolume: 60 });
    h.stop();
  });

  it('switches and levels speech without touching the music fields or the soundtrack backend', async () => {
    const h = harness(v2); await settle();
    h.controller.toggleSpeech(); await settle();
    expect(h.state()).toMatchObject({ enabled: false, volume: 20, speechEnabled: false, speechVolume: 70, activated: false });
    expect(h.stored()).toEqual({ ...v2, speechEnabled: false });
    h.controller.toggleSpeech(); h.controller.setSpeechVolume(193.4); await settle();
    expect(h.stored()).toEqual({ ...v2, speechVolume: 100 });
    h.controller.setSpeechVolume(-10); h.controller.setSpeechVolume(Number.NaN); h.controller.setSpeechVolume(24.6); await settle();
    expect(h.state().speechVolume).toBe(25);
    expect(h.load, 'music is off: speech must not load or prepare the soundtrack').not.toHaveBeenCalled();
    h.stop();
  });

  it('switches and levels music without touching the speech fields', async () => {
    const h = harness({ ...v2, enabled: true }); await settle();
    h.controller.toggle(); h.controller.setVolume(90); await settle();
    expect(h.stored()).toEqual({ ...v2, enabled: false, volume: 90 });
    h.stop();
  });

  it('ignores the speech switch until the stored preference has loaded, and starts speech off after malformed storage', async () => {
    const h = harness('not an object');
    h.controller.toggleSpeech();
    expect(h.state().speechEnabled).toBe(false);
    await settle();
    expect(h.state()).toMatchObject({ loaded: true, enabled: false, speechEnabled: false });
    h.controller.toggleSpeech(); await settle();
    expect(h.stored()).toEqual({ ...silentPreferences, speechEnabled: true });
    h.stop();
  });

  it('keeps ducking tied to the music level, and harmless with music off', async () => {
    const h = harness(v2); await settle();
    // Nothing to duck: no player exists and none may be created by the signal.
    h.controller.setDucked(true); h.controller.setSpeechVolume(10); h.controller.setDucked(false); await settle();
    expect(h.load).not.toHaveBeenCalled();
    expect(h.stored()).toEqual({ ...v2, speechVolume: 10 });
    h.stop();
  });
});
