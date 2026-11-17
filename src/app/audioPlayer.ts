/** SDK-compatible local music playback. Recording and background playback remain disabled. */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { sourceFor } from './musicSources';
import { heldBy } from './pauseSignal';
import { trackFor, type MusicPhase } from './musicTracks';
import type { MusicPlayer, MusicStatus } from './musicController';

/**
 * One audio session for the whole app, prepared once and by whichever surface needs it first.
 * It used to be prepared only by the soundtrack, so a player who muted the music and pressed
 * READ never configured the session at all - which is the sort of thing that plays silence on a
 * device and looks fine in a browser.
 */
let audioMode: Promise<void> | null = null;

export function ensureAudioMode(): Promise<void> {
  audioMode ??= setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false,
    shouldPlayInBackground: false, playsInSilentMode: false, interruptionMode: 'mixWithOthers',
    shouldRouteThroughEarpiece: false }).catch((error: unknown) => { audioMode = null; throw error; });
  return audioMode;
}

export function prepareMusic(): Promise<void> { return ensureAudioMode(); }

/**
 * Give a player back for good. `remove()` alone is not enough: on Android it only forgets the
 * player in the module's map, and the ExoPlayer, its AudioTrack and the media session
 * expo-audio builds for every player live on until the JavaScript object is garbage collected
 * (#186). `release()` is the shared-object call that detaches the native half at once; it is
 * what expo-audio's own `useAudioPlayer` hook runs on unmount. On the web it is `remove()`
 * again, which is harmless. Nothing may touch the player afterwards.
 */
export function releasePlayer(player: { remove(): void; release(): void }): void {
  try { player.remove(); } finally { player.release(); }
}

export function createMusicPlayer(phase: MusicPhase, changed: MusicStatus): MusicPlayer {
  const track = trackFor(phase);
  if (track === null) throw new Error('No score for phase ' + String(phase));
  // Metro packages each literal import in musicSources under the export's asset base path.
  const player = createAudioPlayer(sourceFor(track), { updateInterval: 500, allowsExternalPlayback: false });
  player.loop = true;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    changed(status.playing && !status.isBuffering, Boolean(status.error), heldBy(status));
  });
  return { play: () => { player.play(); }, pause: () => { player.pause(); },
    volume: (value) => { player.volume = value; },
    remove: () => { subscription.remove(); releasePlayer(player); } };
}
