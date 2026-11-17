/** Expo adapter wiring stays local, loops, reports actual errors and releases listeners. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import tracks from '../assets/audio/music/tracks.json';
import { musicSources } from '../src/app/musicSources';
import { createMusicPlayer, prepareMusic, releasePlayer } from '../src/app/audioPlayer';
import { heldBy } from '../src/app/pauseSignal';

const expo = vi.hoisted(() => ({ player: { loop: false, volume: 1, play: vi.fn(), pause: vi.fn(), remove: vi.fn(), release: vi.fn(), addListener: vi.fn() }, createAudioPlayer: vi.fn(), setAudioModeAsync: vi.fn() }));
vi.mock('expo-audio', () => expo);
// The adapter's third status argument exists for Android; the default test platform is web.
const os = vi.hoisted(() => ({ name: 'android' }));
vi.mock('react-native', () => ({ Platform: { get OS() { return os.name; } } }));

it('disables capture/background, loops the bundled asset and forwards only playback/error status', async () => {
  expo.setAudioModeAsync.mockResolvedValue(undefined);
  await prepareMusic();
  expect(expo.setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsRecording: false, shouldPlayInBackground: false, playsInSilentMode: false }));
  const remove = vi.fn(); let status: (value: { playing: boolean; isBuffering: boolean; error: string | null }) => void = () => undefined;
  expo.player.addListener.mockImplementation((_event, listener: typeof status) => { status = listener; return { remove }; });
  expo.createAudioPlayer.mockReturnValue(expo.player);
  const changed = vi.fn(), player = createMusicPlayer(0, changed);
  expect(expo.createAudioPlayer.mock.calls[0]?.[0]).toContain('/assets/audio/music/phase-0/the-guest.mp3');
  expect(expo.player.loop).toBe(true);
  player.volume(0.3); expect(expo.player.volume).toBe(0.3);
  player.play(); player.pause();
  expect(expo.player.play).toHaveBeenCalledOnce(); expect(expo.player.pause).toHaveBeenCalledOnce();
  status({ playing: true, isBuffering: false, error: null });
  status({ playing: true, isBuffering: true, error: null });
  status({ playing: false, isBuffering: false, error: 'denied' });
  // Third argument: a real pause. Buffering is not one (Android keeps `playing` true through it).
  expect(changed.mock.calls).toEqual([[true, false, false], [false, false, false], [false, true, true]]);
  // On the web the same flag is false at every start, loop and stall, so it is never trusted.
  os.name = 'web'; changed.mockClear();
  status({ playing: false, isBuffering: false, error: null });
  expect(changed.mock.calls).toEqual([[false, false, false]]);
  os.name = 'android';
  expect(heldBy({ playing: false }, 'ios')).toBe(false);
  expect(heldBy({ playing: true }, 'android')).toBe(false);
  player.remove(); expect(remove).toHaveBeenCalledOnce(); expect(expo.player.remove).toHaveBeenCalledOnce();
});

it('releases the native player, not only its map entry, and still releases when remove throws (#186)', () => {
  expo.player.remove.mockClear(); expo.player.release.mockClear();
  expo.player.addListener.mockReturnValue({ remove: vi.fn() });
  expo.createAudioPlayer.mockReturnValue(expo.player);
  createMusicPlayer(1, () => undefined).remove();
  expect(expo.player.release).toHaveBeenCalledOnce();
  // Order matters on iOS, where `remove` drops the registry's reference before the detach.
  expect(expo.player.remove.mock.invocationCallOrder[0]).toBeLessThan(expo.player.release.mock.invocationCallOrder[0] ?? 0);
  const order: string[] = [];
  expect(() => { releasePlayer({ remove: () => { order.push('remove'); throw new Error('gone'); }, release: () => { order.push('release'); } }); }).toThrow('gone');
  expect(order).toEqual(['remove', 'release']);
});

it('refuses a phase the manifest has no score for instead of creating a player with no source', () => {
  expo.createAudioPlayer.mockClear();
  expect(() => createMusicPlayer(99, () => undefined)).toThrow('No score for phase 99');
  expect(expo.createAudioPlayer).not.toHaveBeenCalled();
});

it('maps all six sources explicitly and preserves every supplied track byte', () => {
  const bytes = [
    readFileSync('assets/audio/music/phase-0/the-guest.mp3'),
    readFileSync('assets/audio/music/phase-1/the-blind-host.mp3'),
    readFileSync('assets/audio/music/phase-2/the-local-subnet.mp3'),
    readFileSync('assets/audio/music/phase-3/the-dark-forest.mp3'),
    readFileSync('assets/audio/music/phase-4/the-sovereign-corporation.mp3'),
    readFileSync('assets/audio/music/phase-5/post-orbital-transcendence.mp3'),
  ];
  expect(tracks.map((track) => track.phase)).toEqual([0, 1, 2, 3, 4, 5]);
  for (const [index, track] of tracks.entries()) {
    const data = bytes[index];
    if (!data) throw new Error('Missing supplied bytes');
    expect(data.length).toBe(track.bytes);
    expect(createHash('sha256').update(data).digest('hex')).toBe(track.sha256);
    createMusicPlayer(track.phase, () => undefined).remove();
    expect(expo.createAudioPlayer.mock.lastCall?.[0]).toBe(musicSources[track.id]);
    expect(String(musicSources[track.id])).toContain('/' + track.path);
  }
});
