/**
 * The voice adapter plays one clip at a time, releases it when it finishes, and keeps its asset
 * table in step with the generated manifest - so regenerating the clip set cannot silently
 * leave a line that offers to read aloud and then plays nothing.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const voice = vi.hoisted(() => ({
  player: { volume: 1, play: vi.fn(), remove: vi.fn(), addListener: vi.fn() },
  create: vi.fn(),
  mode: vi.fn(() => Promise.resolve()),
}));
vi.mock('expo-audio', () => ({ createAudioPlayer: voice.create, setAudioModeAsync: voice.mode }));

import { hasVoiceClip, playVoiceClip, setVoiceVolume, stopVoiceClip } from '../src/app/voicePlayer';
import { voiceSources } from '../src/app/voiceSources';

const manifest = JSON.parse(readFileSync('assets/audio/voice/MANIFEST.json', 'utf8')) as { clips: { id: string }[] };

function stubListener() {
  let finish: (status: { didJustFinish: boolean }) => void = () => undefined;
  const remove = vi.fn();
  voice.player.addListener.mockImplementation((_event, listener: typeof finish) => { finish = listener; return { remove }; });
  return { fire: (status: { didJustFinish: boolean }) => { finish(status); }, remove };
}

describe('voice clip playback', () => {
  it('bundles exactly the clips the manifest declares', () => {
    for (const clip of manifest.clips) expect(hasVoiceClip(clip.id), clip.id).toBe(true);
    expect(Object.keys(voiceSources).sort()).toEqual(manifest.clips.map((clip) => clip.id).sort());
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
    expect(voice.player.volume).toBeCloseTo(0.42);
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

  it('holds volume inside the preference range rather than trusting the caller', () => {
    voice.create.mockReturnValue(voice.player);
    stubListener();
    playVoiceClip('ambient_04', 500);
    expect(voice.player.volume).toBe(1);
    playVoiceClip('ambient_05', -20);
    expect(voice.player.volume).toBe(0);
  });

  it('stops safely when nothing is playing', () => {
    stopVoiceClip();
    expect(() => { stopVoiceClip(); }).not.toThrow();
  });

  it('follows the preference while a clip is already playing, and does nothing when idle', () => {
    voice.create.mockReturnValue(voice.player);
    stubListener();
    playVoiceClip('ambient_06', 30);
    expect(voice.player.volume).toBeCloseTo(0.3);
    // Panel finding: the volume was set once at start, so a slider change mid-clip was ignored.
    setVoiceVolume(80);
    expect(voice.player.volume).toBeCloseTo(0.8);
    setVoiceVolume(150);
    expect(voice.player.volume).toBe(1);
    stopVoiceClip();
    setVoiceVolume(5);
    expect(voice.player.volume).toBe(1);
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
});
