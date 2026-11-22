/**
 * The heard set (#462) is presentation state in its own slot, never in a game save, and stored state is
 * untrusted input: an exact version 1 value is honoured, anything else means silence. The session that
 * binds the autoplay policy to the app is driven here with plain stores, so every condition it feeds is
 * shown to reach the policy.
 */
import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { HEARD_KEY, heardLines, parseHeard } from '../src/app/voiceHeard';
import { VoiceAutoplay } from '../src/app/voiceAutoplay';
import { armVoiceUnlock, bindVoiceAutoplay } from '../src/app/voiceSession';
import { SAVE_KEY } from '../src/app/storage';
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { createTouchGestures } from '../src/app/musicGesture';
import { memoryStorage } from './app-helpers';

const KNOWN = ['ambient_01', 'office_01', 'world_04'];

describe('the stored heard set', () => {
  it('an empty slot is a fresh install: nothing heard', () => {
    expect([...parseHeard(null, KNOWN)]).toEqual([]);
  });

  it('honours an exact version 1 value, including ids this build does not know', () => {
    const raw = JSON.stringify({ version: 1, heard: ['office_01', 'world_99'] });
    expect([...parseHeard(raw, KNOWN)].sort()).toEqual(['office_01', 'world_99']);
  });

  it.each([
    ['not JSON', '{'],
    ['an unknown version', JSON.stringify({ version: 2, heard: [] })],
    ['an extra key', JSON.stringify({ version: 1, heard: [], extra: 1 })],
    ['an id that is not a content id', JSON.stringify({ version: 1, heard: ['../save'] })],
    ['a non-array', JSON.stringify({ version: 1, heard: 'office_01' })],
    ['an oversized slot', JSON.stringify({ version: 1, heard: ['a'.repeat(80_000)] })],
  ])('reads %s as every known line heard: a damaged slot means silence', (_name, raw) => {
    expect([...parseHeard(raw, KNOWN)].sort()).toEqual([...KNOWN].sort());
  });

  it('writes its own slot, sorted, and reads back what it wrote; the save and the audio slots are untouched', async () => {
    const storage = memoryStorage();
    const lines = heardLines(storage, KNOWN);
    await lines.save(new Set(['world_04', 'ambient_01']));
    expect(storage.getItem(HEARD_KEY)).toBe(JSON.stringify({ version: 1, heard: ['ambient_01', 'world_04'] }));
    expect([...await lines.load()].sort()).toEqual(['ambient_01', 'world_04']);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(storage.getItem(AUDIO_KEY)).toBeNull();
    expect(HEARD_KEY).not.toBe(SAVE_KEY);
  });
});

/** Storage whose reads wait until the test lets them through, as AsyncStorage's do on native. */
function slowStorage(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial));
  const pending: (() => void)[] = [];
  return {
    values,
    getItem: (key: string) => new Promise<string | null>((resolve) => { pending.push(() => { resolve(values.get(key) ?? null); }); }),
    setItem: (key: string, text: string) => { values.set(key, text); },
    release: async () => { for (const next of pending.splice(0)) next(); for (let tick = 0; tick < 8; tick++) await Promise.resolve(); },
  };
}

/** One app process: a policy, its stored heard set, and the load the session starts. */
function boot(storage: ReturnType<typeof slowStorage>) {
  const played: string[] = [];
  const lines = heardLines(storage, KNOWN);
  const autoplay = new VoiceAutoplay({ hasClip: () => true, talking: () => false, play: (id) => { played.push(id); },
    remember: (heard) => { void lines.save(heard); } });
  autoplay.update({ speechEnabled: true, speechVolume: 30, running: true, foreground: true, overlays: 0, unlocked: true });
  const loading = lines.load().then((heard) => { autoplay.load(heard); });
  return { autoplay, played, loading };
}

describe('a READ before the heard slot has loaded (panel finding on #472)', () => {
  it('does not overwrite what was stored, and storage holds the union once the load lands', async () => {
    const storage = slowStorage({ [HEARD_KEY]: JSON.stringify({ version: 1, heard: ['ambient_01', 'world_04'] }) });
    const first = boot(storage);
    // READ on a line before the slow read returns.
    first.autoplay.markHeard('office_01');
    expect(JSON.parse(storage.values.get(HEARD_KEY) ?? '{}')).toEqual({ version: 1, heard: ['ambient_01', 'world_04'] });
    await storage.release(); await first.loading;
    expect(JSON.parse(storage.values.get(HEARD_KEY) ?? '{}')).toEqual({ version: 1, heard: ['ambient_01', 'office_01', 'world_04'] });
    // Restart: every line heard before, and the one read early, stays quiet.
    const second = boot(storage);
    await storage.release(); await second.loading;
    for (const id of KNOWN) second.autoplay.show(id);
    expect(second.played).toEqual([]);
  });

  it('writes nothing after the load when nothing was heard early, so a plain start never rewrites the slot', async () => {
    const stored = JSON.stringify({ version: 1, heard: ['world_04'] });
    const storage = slowStorage({ [HEARD_KEY]: stored });
    const writes: string[] = [];
    const setItem = storage.setItem;
    storage.setItem = (key, text) => { writes.push(text); setItem(key, text); };
    const run = boot(storage);
    await storage.release(); await run.loading;
    expect(writes).toEqual([]);
    run.autoplay.show('office_01');
    expect(run.played).toEqual(['office_01']);
  });
});

function sources() {
  const game = createStore<{ ready: boolean; paused: boolean; game: { ending: unknown } }>(() => ({ ready: true, paused: false, game: { ending: null } }));
  const speech = createStore(() => ({ speechEnabled: true, speechVolume: 30 }));
  const overlays = createStore(() => ({ open: 0 }));
  const speaking = createStore<{ id: string | null }>(() => ({ id: null }));
  let foreground = true;
  const lifecycleListeners = new Set<(active: boolean) => void>();
  const lifecycle = { current: () => foreground, subscribe: (listener: (active: boolean) => void) => { lifecycleListeners.add(listener); return () => { lifecycleListeners.delete(listener); }; } };
  const setForeground = (active: boolean) => { foreground = active; for (const listener of lifecycleListeners) listener(active); };
  return { game, speech, overlays, speaking, lifecycle, setForeground };
}

function wired() {
  const state = sources();
  const played: string[] = [];
  const autoplay = new VoiceAutoplay({ hasClip: () => true, talking: () => state.speaking.getState().id !== null,
    play: (id) => { played.push(id); state.speaking.setState({ id }); }, remember: () => undefined });
  const unbind = bindVoiceAutoplay(autoplay, state);
  const gestures = createTouchGestures();
  armVoiceUnlock(autoplay, gestures);
  autoplay.load([]);
  return { state, played, autoplay, unbind, touch: () => gestures.touch() };
}

describe('the voice session', () => {
  it('waits for the first touch, then plays the line on screen', () => {
    const rig = wired();
    rig.autoplay.show('office_01');
    expect(rig.played).toEqual([]);
    rig.touch();
    expect(rig.played).toEqual(['office_01']);
  });

  it.each([
    ['the player pauses', (state: ReturnType<typeof sources>) => { state.game.setState({ paused: true }); }, (state: ReturnType<typeof sources>) => { state.game.setState({ paused: false }); }],
    ['the run has ended', (state: ReturnType<typeof sources>) => { state.game.setState({ game: { ending: 'x' } }); }, (state: ReturnType<typeof sources>) => { state.game.setState({ game: { ending: null } }); }],
    ['a modal is open', (state: ReturnType<typeof sources>) => { state.overlays.setState({ open: 1 }); }, (state: ReturnType<typeof sources>) => { state.overlays.setState({ open: 0 }); }],
    ['speech is switched off', (state: ReturnType<typeof sources>) => { state.speech.setState({ speechEnabled: false }); }, (state: ReturnType<typeof sources>) => { state.speech.setState({ speechEnabled: true }); }],
    ['speech is at zero', (state: ReturnType<typeof sources>) => { state.speech.setState({ speechVolume: 0 }); }, (state: ReturnType<typeof sources>) => { state.speech.setState({ speechVolume: 30 }); }],
    ['the app is in the background', (state: ReturnType<typeof sources>) => { state.setForeground(false); }, (state: ReturnType<typeof sources>) => { state.setForeground(true); }],
  ])('holds the queue while %s and plays when it clears', (_name, close, open) => {
    const rig = wired();
    rig.touch();
    close(rig.state);
    rig.autoplay.show('office_01');
    expect(rig.played).toEqual([]);
    open(rig.state);
    expect(rig.played).toEqual(['office_01']);
  });

  it('starts the next queued line when the clip in flight ends, and stops listening once unbound', () => {
    const rig = wired();
    rig.touch();
    rig.autoplay.show('office_01'); rig.autoplay.show('world_04');
    expect(rig.played).toEqual(['office_01']);
    rig.state.speaking.setState({ id: null });
    expect(rig.played).toEqual(['office_01', 'world_04']);
    // Unbound, the end of a clip no longer reaches the policy: the queued line waits.
    rig.autoplay.show('ambient_01');
    rig.unbind();
    rig.state.speaking.setState({ id: null });
    expect(rig.played).toEqual(['office_01', 'world_04']);
    expect(rig.autoplay.pending()).toEqual(['ambient_01']);
  });
});
