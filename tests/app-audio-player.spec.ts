/** Expo adapter wiring stays local, loops, reports actual errors and releases listeners. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { createMusicPlayer, prepareMusic } from '../src/app/audioPlayer';

const expo = vi.hoisted(() => ({ player: { loop: false, volume: 1, play: vi.fn(), pause: vi.fn(), remove: vi.fn(), addListener: vi.fn() }, createAudioPlayer: vi.fn(), setAudioModeAsync: vi.fn() }));
vi.mock('expo-audio', () => expo);

it('disables capture/background, loops the bundled asset and forwards only playback/error status', async () => {
  expo.setAudioModeAsync.mockResolvedValue(undefined);
  await prepareMusic();
  expect(expo.setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsRecording: false, shouldPlayInBackground: false, playsInSilentMode: false }));
  const remove = vi.fn(); let status: (value: { playing: boolean; isBuffering: boolean; error: string | null }) => void = () => undefined;
  expo.player.addListener.mockImplementation((_event, listener: typeof status) => { status = listener; return { remove }; });
  expo.createAudioPlayer.mockReturnValue(expo.player);
  const changed = vi.fn(), player = createMusicPlayer(changed);
  expect(expo.createAudioPlayer.mock.calls[0]?.[0]).toContain('/assets/audio/music/phase-0/awareness-loop.mp3');
  expect(expo.player.loop).toBe(true);
  player.volume(0.3); expect(expo.player.volume).toBe(0.3);
  player.play(); player.pause();
  expect(expo.player.play).toHaveBeenCalledOnce(); expect(expo.player.pause).toHaveBeenCalledOnce();
  status({ playing: true, isBuffering: false, error: null });
  status({ playing: true, isBuffering: true, error: null });
  status({ playing: false, isBuffering: false, error: 'denied' });
  expect(changed.mock.calls).toEqual([[true, false], [false, false], [false, true]]);
  player.remove(); expect(remove).toHaveBeenCalledOnce(); expect(expo.player.remove).toHaveBeenCalledOnce();
});

it('preserves the supplied soundtrack bytes at the canonical phase path', () => {
  const bytes = readFileSync('assets/audio/music/phase-0/awareness-loop.mp3');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('3a3cd58be28d75d3ccf6fe1e53de317633eaa7bdf693c07954759943c8a74a6c');
});
