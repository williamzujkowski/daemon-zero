/** SDK-compatible local music playback. Recording and background playback remain disabled. */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { musicSources } from './musicSources';
import type { MusicPhase } from './musicTracks';
import type { MusicPlayer } from './musicController';

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

export function createMusicPlayer(phase: MusicPhase, changed: (playing: boolean, error: boolean) => void): MusicPlayer {
  // Metro packages this literal import under each export's asset base path.
  const player = createAudioPlayer(musicSources[phase], { updateInterval: 500, allowsExternalPlayback: false });
  player.loop = true;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    changed(status.playing && !status.isBuffering, Boolean(status.error));
  });
  return { play: () => { player.play(); }, pause: () => { player.pause(); },
    volume: (value) => { player.volume = value; },
    remove: () => { subscription.remove(); player.remove(); } };
}
