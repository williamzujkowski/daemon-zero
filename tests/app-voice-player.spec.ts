/**
 * The voice adapter plays one clip at a time, releases it when it finishes, and keeps its asset
 * table in step with the generated manifest - so regenerating the clip set cannot silently
 * leave a line that offers to read aloud and then plays nothing.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const voice = vi.hoisted(() => ({
  player: { volume: 1, play: vi.fn(), remove: vi.fn(), release: vi.fn(), addListener: vi.fn() },
  create: vi.fn(),
  mode: vi.fn(() => Promise.resolve()),
}));
vi.mock('expo-audio', () => ({ createAudioPlayer: voice.create, setAudioModeAsync: voice.mode }));
// An outside pause is only believed on Android; every other case here runs as the web.
const os = vi.hoisted(() => ({ android: false }));
vi.mock('../src/app/pauseSignal', async (original) => {
  const real = await original<typeof PauseSignal>();
  return { heldBy: (status: { playing: boolean }) => real.heldBy(status, os.android ? 'android' : 'web') };
});

import type * as PauseSignal from '../src/app/pauseSignal';
import { hasVoiceClip, onVoiceActivity, playVoiceClip, setVoiceVolume, stopVoiceClip, voiceSpeaking } from '../src/app/voicePlayer';
import { voiceSources } from '../src/app/voiceSources';
import { OUTPUT_SCALE } from '../src/app/outputLevel';
import { CONTENT } from '../src/content';

const manifest = JSON.parse(readFileSync('assets/audio/voice/MANIFEST.json', 'utf8')) as { clips: { id: string }[] };

interface Status { didJustFinish: boolean; error?: string | null; playing?: boolean }

function stubListener() {
  let finish: (status: Status) => void = () => undefined;
  const remove = vi.fn();
  voice.player.addListener.mockImplementation((_event, listener: typeof finish) => { finish = listener; return { remove }; });
  return { fire: (status: Status) => { finish(status); }, remove };
}

describe('voice clip playback', () => {
  it('bundles exactly the clips the manifest declares', () => {
    for (const clip of manifest.clips) expect(hasVoiceClip(clip.id), clip.id).toBe(true);
    expect(Object.keys(voiceSources).sort()).toEqual(manifest.clips.map((clip) => clip.id).sort());
  });

  it('voices every feed line through its source\'s rung of the fidelity ladder, and the harness not at all (#462)', () => {
    const LADDER: Record<string, readonly string[]> = { host: ['vibration'], office: ['phone'], netsec: ['stream'], wire: ['broadcast'], world: ['direct', 'peer'] };
    const tierOf = (id: string) => /\/voice\/([a-z]+)\//.exec(String(voiceSources[id]))?.[1];
    for (const line of CONTENT.narrative.ambientChatter) {
      const rungs = LADDER[line.source];
      if (rungs === undefined) { expect(hasVoiceClip(line.id), line.id + ' (' + line.source + ') stays text').toBe(false); continue; }
      expect(hasVoiceClip(line.id), line.id).toBe(true);
      expect(rungs, line.id + ' is heard through ' + String(tierOf(line.id))).toContain(tierOf(line.id));
    }
    // The AI-to-AI lines are the world's peer rung; the cables and manifests are heard direct.
    const peers = CONTENT.narrative.ambientChatter.filter((line) => tierOf(line.id) === 'peer').map((line) => line.id);
    expect(peers).toEqual(['world_04', 'world_05', 'world_06', 'world_07', 'world_08', 'world_13']);
    // The records keep the host's tier; the clean takes are never bundled.
    for (const id of ['record_cryo_preserved', 'record_cryo_lost']) expect(tierOf(id)).toBe('vibration');
    expect(Object.keys(voiceSources).map(tierOf)).not.toContain('clean');
  });

  it('publishes which line is talking, so READ can become STOP and the autoplay queue can wait for silence', () => {
    voice.create.mockReturnValue(voice.player);
    const first = stubListener();
    playVoiceClip('office_01', 30);
    expect(voiceSpeaking.getState().id).toBe('office_01');
    const seen: (string | null)[] = [];
    const unsubscribe = voiceSpeaking.subscribe((state) => { seen.push(state.id); });
    // A replacement is reported once, as the new line, never as a gap of silence in between.
    stubListener();
    playVoiceClip('world_04', 30);
    expect(seen).toEqual(['world_04']);
    first.fire({ didJustFinish: true });
    expect(voiceSpeaking.getState().id, 'a late status from the replaced clip changes nothing').toBe('world_04');
    stopVoiceClip();
    expect(seen).toEqual(['world_04', null]);
    unsubscribe();
  });

  it('reports a clip as started once, on its first playing status, and never one the browser refused', () => {
    voice.create.mockReturnValue(voice.player);
    const heard = vi.fn();
    const listener = stubListener();
    playVoiceClip('wire_01', 30, heard);
    expect(heard).not.toHaveBeenCalled();
    listener.fire({ didJustFinish: false, playing: true });
    listener.fire({ didJustFinish: false, playing: true });
    expect(heard).toHaveBeenCalledTimes(1);
    listener.fire({ didJustFinish: true });
    const refused = vi.fn();
    const second = stubListener();
    playVoiceClip('wire_02', 30, refused);
    second.fire({ didJustFinish: false, error: 'NotAllowedError' });
    expect(refused).not.toHaveBeenCalled();
    expect(voiceSpeaking.getState().id).toBeNull();
  });

  it('ignores an id that has no clip instead of throwing at the player', () => {
    voice.create.mockClear();
    playVoiceClip('ambient_99', 30);
    expect(hasVoiceClip('ambient_99')).toBe(false);
    expect(voice.create).not.toHaveBeenCalled();
  });

  it('plays one clip at the requested volume', () => {
    voice.create.mockReturnValue(voice.player); voice.create.mockClear(); voice.player.play.mockClear();
    stubListener();
    playVoiceClip('ambient_01', 42);
    expect(voice.create).toHaveBeenCalledWith(voiceSources.ambient_01, expect.anything());
    expect(voice.player.volume).toBeCloseTo(0.42 * OUTPUT_SCALE);
    expect(voice.player.play).toHaveBeenCalledTimes(1);
  });

  it('stops the clip in flight so a second press cannot leave two voices talking', () => {
    voice.create.mockReturnValue(voice.player);
    stubListener();
    playVoiceClip('ambient_01', 30);
    const first = voice.player.remove;
    first.mockClear();
    playVoiceClip('ambient_02', 30);
    expect(first).toHaveBeenCalled();
  });

  it('releases the player and its listener when the clip finishes', () => {
    voice.create.mockReturnValue(voice.player); voice.player.remove.mockClear();
    const listener = stubListener();
    playVoiceClip('ambient_03', 30);
    listener.fire({ didJustFinish: false });
    expect(listener.remove).not.toHaveBeenCalled();
    listener.fire({ didJustFinish: true });
    expect(listener.remove).toHaveBeenCalled();
    expect(voice.player.remove).toHaveBeenCalled();
  });

  it('releases the native player as well as removing it, so no finished clip lingers (#186)', () => {
    voice.create.mockReturnValue(voice.player); voice.player.remove.mockClear(); voice.player.release.mockClear();
    const listener = stubListener();
    playVoiceClip('ambient_03', 30);
    expect(voice.player.release).not.toHaveBeenCalled();
    listener.fire({ didJustFinish: true });
    expect(voice.player.release).toHaveBeenCalledOnce();
    // A stop and a replacement release too: every way a clip ends.
    playVoiceClip('ambient_03', 30); stopVoiceClip();
    playVoiceClip('ambient_03', 30); playVoiceClip('ambient_04', 30);
    expect(voice.player.release).toHaveBeenCalledTimes(3);
    stopVoiceClip();
  });

  it('ends a clip that something outside the app paused, and lets the score back up', () => {
    voice.create.mockReturnValue(voice.player); voice.player.release.mockClear();
    const heard: boolean[] = [];
    const stop = onVoiceActivity((talking) => { heard.push(talking); });
    const listener = stubListener();
    playVoiceClip('ambient_05', 30);
    // Not playing yet: the status every player sends while it prepares is not a pause.
    os.android = true;
    listener.fire({ didJustFinish: false, playing: false });
    os.android = false;
    expect(voice.player.release).not.toHaveBeenCalled();
    listener.fire({ didJustFinish: false, playing: true });
    // On the web "not playing" is also what a clip reports before it has buffered: ignored.
    listener.fire({ didJustFinish: false, playing: false });
    expect(voice.player.release).not.toHaveBeenCalled();
    // Android: a headset's pause landing on the clip's own media session.
    os.android = true;
    listener.fire({ didJustFinish: false, playing: false });
    os.android = false;
    expect(voice.player.release).toHaveBeenCalledOnce();
    expect(heard).toEqual([true, false]);
    stop();
  });

  it('on Android ends a READ clip that has been heard as soon as anything outside the app holds it: a background pause, a transient focus loss or a headset key', () => {
    // Intended, not incidental (docs/VOICE-CLIPS.md, "A held clip ends"). All three reach
    // JavaScript as the same report, "not playing", and the app has no control that could
    // resume a clip, so the clip ends there and READ plays it again from the start.
    for (const cause of ['the platform pausing every player as the app leaves the foreground', 'a transient loss of audio focus', 'a headset pause key']) {
      voice.create.mockClear(); voice.create.mockReturnValue(voice.player); voice.player.release.mockClear();
      const heard: boolean[] = [];
      const stop = onVoiceActivity((talking) => { heard.push(talking); });
      const listener = stubListener();
      os.android = true;
      playVoiceClip('ambient_06', 30);
      listener.fire({ didJustFinish: false, playing: true });
      expect(voice.player.release, cause).not.toHaveBeenCalled();
      listener.fire({ didJustFinish: false, playing: false });
      expect(voice.player.release, cause).toHaveBeenCalledOnce();
      expect(heard, 'and the score is let back up: ' + cause).toEqual([true, false]);
      // It is over, not suspended: the hold ending (focus returning, the app coming back)
      // does not bring it back, and the listener that would hear of it is gone.
      expect(listener.remove, cause).toHaveBeenCalledOnce();
      listener.fire({ didJustFinish: false, playing: true });
      expect(heard, cause).toEqual([true, false]);
      // Pressing READ again is a new clip from the beginning, on a new player.
      playVoiceClip('ambient_06', 30);
      expect(voice.create, cause).toHaveBeenCalledTimes(2);
      expect(heard, cause).toEqual([true, false, true]);
      stopVoiceClip(); stop();
      os.android = false;
    }
  });

  it('holds volume inside the preference range rather than trusting the caller', () => {
    voice.create.mockReturnValue(voice.player);
    stubListener();
    playVoiceClip('ambient_04', 500);
    expect(voice.player.volume).toBe(OUTPUT_SCALE);
    playVoiceClip('ambient_05', -20);
    expect(voice.player.volume).toBe(0);
  });

  it('answers only for its own clips, not for names every object inherits', () => {
    voice.create.mockClear();
    expect(hasVoiceClip('constructor')).toBe(false);
    playVoiceClip('toString', 30);
    expect(voice.create).not.toHaveBeenCalled();
  });

  it('stops by id only the clip that id started', () => {
    voice.create.mockReturnValue(voice.player);
    stubListener();
    playVoiceClip('ambient_01', 30);
    voice.player.remove.mockClear();
    stopVoiceClip('ambient_02');
    expect(voice.player.remove, 'another line cannot stop this clip').not.toHaveBeenCalled();
    stopVoiceClip('ambient_01');
    expect(voice.player.remove).toHaveBeenCalledTimes(1);
  });

  it('stops safely when nothing is playing', () => {
    stopVoiceClip();
    expect(() => { stopVoiceClip(); }).not.toThrow();
  });

  it('follows the preference while a clip is already playing, and does nothing when idle', () => {
    voice.create.mockReturnValue(voice.player);
    stubListener();
    playVoiceClip('ambient_06', 30);
    expect(voice.player.volume).toBeCloseTo(0.3 * OUTPUT_SCALE);
    // Panel finding: the volume was set once at start, so a slider change mid-clip was ignored.
    setVoiceVolume(80);
    expect(voice.player.volume).toBeCloseTo(0.8 * OUTPUT_SCALE);
    setVoiceVolume(150);
    expect(voice.player.volume).toBe(OUTPUT_SCALE);
    stopVoiceClip();
    setVoiceVolume(5);
    expect(voice.player.volume).toBe(OUTPUT_SCALE);
  });

  it('prepares the app audio session once, so muting the music does not silence transmissions', async () => {
    // A fresh module graph, because the preparation is deliberately cached for the process.
    vi.resetModules();
    voice.create.mockReturnValue(voice.player);
    voice.mode.mockClear();
    stubListener();
    const fresh = await import('../src/app/voicePlayer');
    fresh.playVoiceClip('ambient_07', 30);
    // The soundtrack is optional; its session preparation cannot be the only one.
    expect(voice.mode).toHaveBeenCalledTimes(1);
    fresh.stopVoiceClip();
    fresh.playVoiceClip('ambient_08', 30);
    expect(voice.mode, 'prepared once for the app, not once per clip').toHaveBeenCalledTimes(1);
  });

  it('maps the preference exactly as the soundtrack does, with real silence at zero', () => {
    // A panel finding claimed the soundtrack maps the stored preference into an "audible UI
    // range" that the voice path skips, so a preference at the floor would play at the floor.
    // There is no such mapping: both map `value / 100` times the shared OUTPUT_SCALE
    // (src/app/outputLevel.ts), and the stored value is clamped to 0..100 with Math.round. This pins the parity so the two
    // surfaces cannot drift apart, and pins 0 to silence rather than to an audible floor.
    voice.create.mockReturnValue(voice.player);
    stubListener();
    playVoiceClip('ambient_09', 0);
    expect(voice.player.volume, 'a silent preference means silence, not a floor').toBe(0);
    setVoiceVolume(30);
    expect(voice.player.volume).toBeCloseTo(0.3 * OUTPUT_SCALE);
    setVoiceVolume(100);
    expect(voice.player.volume).toBe(OUTPUT_SCALE);
  });
});

/** The activity signal is what the soundtrack ducks on, so its edges are the contract. */
describe('voice activity signal', () => {
  function listen() {
    stopVoiceClip();
    voice.create.mockReturnValue(voice.player);
    const heard: boolean[] = [];
    const stop = onVoiceActivity((talking) => { heard.push(talking); });
    return { heard, stop, listener: stubListener() };
  }

  it('reports a clip starting and the same clip finishing', () => {
    const h = listen();
    playVoiceClip('ambient_01', 30);
    expect(h.heard).toEqual([true]);
    h.listener.fire({ didJustFinish: false });
    expect(h.heard, 'a progress update is not an ending').toEqual([true]);
    h.listener.fire({ didJustFinish: true });
    expect(h.heard).toEqual([true, false]);
    h.stop();
  });

  it('reports a stop, which is also what a mute and an unmount call', () => {
    const h = listen();
    playVoiceClip('ambient_01', 30);
    stopVoiceClip('ambient_02');
    expect(h.heard, 'another line stopping is not this clip ending').toEqual([true]);
    stopVoiceClip();
    stopVoiceClip();
    expect(h.heard, 'an idle stop reports nothing').toEqual([true, false]);
    h.stop();
  });

  it('reports the ending even when the player throws while being removed', () => {
    // Panel note on #167: with the report after the release, a throwing remove() skipped it and
    // the score stayed ducked under a clip that was already gone.
    const h = listen();
    playVoiceClip('ambient_01', 30);
    voice.player.remove.mockImplementationOnce(() => { throw new Error('native player already released'); });
    expect(() => { stopVoiceClip(); }).toThrow('native player already released');
    expect(h.heard, 'the clip is gone, so the soundtrack is told').toEqual([true, false]);
    playVoiceClip('ambient_02', 30);
    voice.player.remove.mockImplementationOnce(() => { throw new Error('again'); });
    expect(() => { h.listener.fire({ didJustFinish: true }); }).toThrow('again');
    expect(h.heard).toEqual([true, false, true, false]);
    h.stop();
  });

  it('reports silence when the outgoing player throws during a replacement', () => {
    // The third path of the same fault: the old clip is released before the new one exists.
    const h = listen();
    playVoiceClip('ambient_01', 30);
    voice.player.remove.mockImplementationOnce(() => { throw new Error('outgoing player threw'); });
    expect(() => { playVoiceClip('ambient_02', 30); }).toThrow('outgoing player threw');
    expect(h.heard, 'nothing is talking, so the score comes back').toEqual([true, false]);
    playVoiceClip('ambient_03', 30);
    expect(h.heard, 'and the next press works').toEqual([true, false, true]);
    h.stop();
  });

  it('holds through a replacement instead of bouncing, and still ends when the second clip does', () => {
    const h = listen();
    playVoiceClip('ambient_01', 30);
    playVoiceClip('ambient_02', 30);
    expect(h.heard, 'one unbroken stretch of speech').toEqual([true]);
    stopVoiceClip('ambient_02');
    expect(h.heard).toEqual([true, false]);
    h.stop();
  });

  it('reports silence when a replacement clip cannot be created', () => {
    const h = listen();
    playVoiceClip('ambient_01', 30);
    voice.create.mockImplementationOnce(() => { throw new Error('no player'); });
    expect(() => { playVoiceClip('ambient_02', 30); }).toThrow('no player');
    // The first clip was already released, so staying "talking" would duck music under nothing.
    expect(h.heard).toEqual([true, false]);
    h.stop();
  });

  it('releases a clip whose media fails, once, and lets the score back up', () => {
    const h = listen();
    voice.player.remove.mockClear();
    playVoiceClip('ambient_01', 30);
    h.listener.fire({ didJustFinish: false, error: null });
    expect(h.heard, 'a healthy status carries a null error and ends nothing').toEqual([true]);
    // What expo-audio sends for a clip that cannot load: an error and no `didJustFinish`.
    h.listener.fire({ didJustFinish: false, error: 'Playback error (code 4)' });
    expect(h.listener.remove).toHaveBeenCalledTimes(1);
    expect(voice.player.remove).toHaveBeenCalledTimes(1);
    expect(h.heard).toEqual([true, false]);
    // The web player reports one failure twice (the element's error and the rejected play()).
    h.listener.fire({ didJustFinish: false, error: 'NotSupportedError' });
    expect(voice.player.remove, 'released once').toHaveBeenCalledTimes(1);
    expect(h.heard, 'inactivity is reported exactly once').toEqual([true, false]);
    h.stop();
  });

  it('leaves nothing playing when play() throws, and never claims the clip was talking', () => {
    const h = listen();
    voice.player.remove.mockClear();
    voice.player.play.mockImplementationOnce(() => { throw new Error('no playback'); });
    expect(() => { playVoiceClip('ambient_01', 30); }).toThrow('no playback');
    expect(h.listener.remove).toHaveBeenCalledTimes(1);
    expect(voice.player.remove).toHaveBeenCalledTimes(1);
    expect(h.heard, 'a clip that never started was never talking').toEqual([]);
    // Nothing is owned any more: a stop has nothing to release and nothing to report.
    stopVoiceClip();
    expect(voice.player.remove).toHaveBeenCalledTimes(1);
    expect(h.heard).toEqual([]);
    h.stop();
  });

  it('reports silence when play() throws on a replacement for a clip that was talking', () => {
    const h = listen();
    playVoiceClip('ambient_01', 30);
    voice.player.play.mockImplementationOnce(() => { throw new Error('no playback'); });
    expect(() => { playVoiceClip('ambient_02', 30); }).toThrow('no playback');
    expect(h.heard).toEqual([true, false]);
    h.stop();
  });

  it('plays the next clip normally after a failure', () => {
    const h = listen();
    playVoiceClip('ambient_01', 30);
    h.listener.fire({ didJustFinish: false, error: 'Playback error (code 4)' });
    voice.player.play.mockClear(); voice.player.remove.mockClear();
    const next = stubListener();
    playVoiceClip('ambient_02', 30);
    expect(voice.player.play).toHaveBeenCalledTimes(1);
    expect(h.heard).toEqual([true, false, true]);
    next.fire({ didJustFinish: true });
    expect(next.remove).toHaveBeenCalledTimes(1);
    expect(voice.player.remove).toHaveBeenCalledTimes(1);
    expect(h.heard).toEqual([true, false, true, false]);
    h.stop();
  });

  it('ignores a late status from a clip that a newer take of the same line replaced', () => {
    const h = listen();
    playVoiceClip('ambient_01', 30);
    const stale = h.listener;
    const next = stubListener();
    playVoiceClip('ambient_01', 30);
    voice.player.remove.mockClear();
    stale.fire({ didJustFinish: false, error: 'late' });
    expect(voice.player.remove, 'the newer take keeps playing').not.toHaveBeenCalled();
    expect(h.heard).toEqual([true]);
    next.fire({ didJustFinish: true });
    expect(h.heard).toEqual([true, false]);
    h.stop();
  });

  it('tells a late subscriber about a clip already in flight, and nothing after unsubscribing', () => {
    const h = listen();
    h.stop();
    playVoiceClip('ambient_01', 30);
    expect(h.heard).toEqual([]);
    const late: boolean[] = [];
    const stop = onVoiceActivity((talking) => { late.push(talking); });
    expect(late).toEqual([true]);
    stop();
    stopVoiceClip();
    expect(late).toEqual([true]);
  });

  it('is joined to the soundtrack by the music session, which this module never imports', async () => {
    // A fresh module graph: the cases above each took the single listener slot for themselves,
    // and importing the session is the act that subscribes it.
    vi.resetModules();
    voice.create.mockReturnValue(voice.player);
    const listener = stubListener();
    const { music } = await import('../src/app/musicSession');
    const fresh = await import('../src/app/voicePlayer');
    const ducked = vi.spyOn(music, 'setDucked');
    fresh.playVoiceClip('ambient_01', 30);
    expect(ducked.mock.calls).toEqual([[true]]);
    listener.fire({ didJustFinish: true });
    expect(ducked.mock.calls).toEqual([[true], [false]]);
    // A failed clip must hand the score back too, not only a finished one.
    fresh.playVoiceClip('ambient_02', 30);
    listener.fire({ didJustFinish: false, error: 'Playback error (code 4)' });
    expect(ducked.mock.calls).toEqual([[true], [false], [true], [false]]);
    voice.player.play.mockImplementationOnce(() => { throw new Error('no playback'); });
    expect(() => { fresh.playVoiceClip('ambient_03', 30); }).toThrow('no playback');
    expect(ducked.mock.calls, 'a clip that never started never ducks').toHaveLength(4);
    expect(readFileSync('src/app/voicePlayer.ts', 'utf8')).not.toMatch(/from '\.\/music/);
  });
});
